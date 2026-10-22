import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFigureGeometry, projectPoint, resolveExperiment, transformPoint, worldAnchor, type ExperimentState, type ResolvedExperiment, type ResolvedCamera, type SceneObject, type Vec3 } from './core';

export type InspectView = 'top' | 'side' | 'free';
export interface InspectCameraSnapshot { position: number[]; quaternion: number[]; up: number[]; fov: number }
export const MODULE_TITLES = { d09: '深度线索 · D09', d10: '错位片场 · D10', d12: '机位与焦距 · D12' };
const background = '#aab8bc';

export function shotCamera(input: ResolvedCamera) {
  const camera = new THREE.PerspectiveCamera(input.verticalFov, 16 / 9, input.near, input.far);
  camera.position.fromArray(input.position);
  camera.quaternion.fromArray(input.quaternion);
  camera.filmGauge = 36;
  camera.updateMatrixWorld();
  return camera;
}

function release(root: THREE.Object3D) {
  root.traverse(child => {
    const renderable = child as THREE.Mesh;
    renderable.geometry?.dispose();
    if (renderable.material) for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) {
      const texture = (material as THREE.MeshBasicMaterial).map;
      texture?.dispose(); material.dispose();
    }
  });
  root.clear();
}

function labelTexture(text: string, color = '#18262d') {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = color; ctx.font = '600 140px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 130);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, material); result.position.set(x, y, z);
  result.castShadow = true; result.receiveShadow = true; return result;
}

function objectRoot(object: SceneObject, unlit: boolean, inspect: boolean) {
  const root = new THREE.Group(); root.userData.objectId = object.id;
  const [w, h, d] = object.dimensions;
  const material = unlit || inspect ? new THREE.MeshBasicMaterial({ color: object.color, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide });
  const dark = unlit || inspect ? new THREE.MeshBasicMaterial({ color: '#263d43' }) : new THREE.MeshStandardMaterial({ color: '#263d43', roughness: 0.7 });
  if (object.kind === 'sphere') {
    root.add(mesh(new THREE.SphereGeometry(0.5, 40, 28), material, 0, h / 2, 0));
    root.children[0].scale.set(w, h, d);
  } else if (object.kind === 'figure') {
    root.add(mesh(createFigureGeometry(object.dimensions), material));
  } else if (object.kind === 'support') {
    root.add(mesh(new THREE.BoxGeometry(w, h * .12, Math.max(d, .5)), material, 0, h * .94, 0));
    root.add(mesh(new THREE.BoxGeometry(w * .2, h * .78, Math.max(d * .55, .25)), dark, 0, h * .45, 0));
    root.add(mesh(new THREE.BoxGeometry(w * .8, h * .1, Math.max(d, .5)), material.clone(), 0, h * .05, 0));
  } else if (object.kind === 'frame') {
    const thickness = .12;
    root.add(mesh(new THREE.BoxGeometry(w, thickness, d || thickness), material, 0, h - thickness / 2, 0));
    for (const sign of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(thickness, h, d || thickness), material.clone(), sign * (w - thickness) / 2, h / 2, 0));
  } else {
    root.add(mesh(object.kind === 'card' && !inspect ? new THREE.PlaneGeometry(w, h) : new THREE.BoxGeometry(w, h, Math.max(d, .025)), material, 0, h / 2, 0));
    if (object.kind === 'card') {
      const front = new THREE.MeshBasicMaterial({ map: labelTexture(object.id === 'subject' ? 'S' : object.id === 'background' ? 'B' : object.id), transparent: true, depthWrite: false });
      const faceZ = inspect ? Math.max(d, .025) / 2 + .002 : .0002;
      root.add(mesh(new THREE.PlaneGeometry(Math.min(w * .7, h * .45), Math.min(w * .7, h * .45)), front, 0, h * .6, faceZ));
      const accent = new THREE.MeshBasicMaterial({ color: '#f7f3e4', transparent: true, opacity: .7 });
      root.add(mesh(new THREE.PlaneGeometry(w * .52, .012), accent, 0, h * .2, faceZ + .0001));
    }
  }
  // Unused dark material belongs to no mesh when this is not a support.
  if (object.kind !== 'support') dark.dispose();
  root.traverse(child => { child.userData.objectId = object.id; });
  return root;
}

function lines(points: THREE.Vector3[], color: THREE.ColorRepresentation, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed ? new THREE.LineDashedMaterial({ color, dashSize: .25, gapSize: .15, transparent: true, opacity: .65 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 });
  const line = new THREE.LineSegments(geometry, material); if (dashed) line.computeLineDistances(); return line;
}

function cameraMarker(input: ResolvedCamera, reference = false) {
  const group = new THREE.Group(); const color = reference ? '#6ad7d1' : '#efbc58';
  const cam = shotCamera(input); const distance = 10;
  const halfH = Math.tan(THREE.MathUtils.degToRad(input.verticalFov / 2)) * distance;
  const halfW = halfH * 16 / 9;
  const localCorners = [[-halfW, -halfH, -distance], [halfW, -halfH, -distance], [halfW, halfH, -distance], [-halfW, halfH, -distance]].map(p => new THREE.Vector3(...p as Vec3).applyQuaternion(cam.quaternion).add(cam.position));
  const points: THREE.Vector3[] = [];
  localCorners.forEach((corner, i) => points.push(cam.position.clone(), corner, corner.clone(), localCorners[(i + 1) % 4].clone()));
  group.add(lines(points, color, reference));
  const body = mesh(new THREE.BoxGeometry(.5, .35, .6), new THREE.MeshBasicMaterial({ color, wireframe: reference }));
  body.position.copy(cam.position); body.quaternion.copy(cam.quaternion); group.add(body);
  return group;
}

const depthMaterial = () => new THREE.ShaderMaterial({
  vertexShader: 'varying float depthM; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); depthM=-mv.z; gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'varying float depthM; void main(){ float t=clamp(depthM/30.,0.,1.); vec3 c=t<.5?mix(vec3(.12,.8,.8),vec3(1.,.7,.24),t*2.):mix(vec3(1.,.7,.24),vec3(.62,.3,.7),(t-.5)*2.); gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}',
  side: THREE.DoubleSide,
});

export class SceneRig {
  scene = new THREE.Scene(); objects = new THREE.Group(); environment = new THREE.Group(); helpers = new THREE.Group();
  roots = new Map<string, { signature: string; root: THREE.Group }>();
  private envSignature = ''; private helperSignature = ''; private depth = depthMaterial();
  private lamp: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  constructor(public inspect = false) {
    this.scene.background = new THREE.Color(inspect ? '#10212b' : background);
    this.scene.add(this.objects, this.environment, this.helpers);
    this.fill = new THREE.HemisphereLight('#ecf6fb', '#5b6261', 2.3);
    this.scene.add(this.fill);
    this.lamp = new THREE.DirectionalLight('#fff3da', 3.0); this.lamp.position.set(-5, 11, 5); this.lamp.target.position.set(0, 0, -10);
    this.lamp.shadow.mapSize.set(1024, 1024); this.lamp.shadow.camera.left = -12; this.lamp.shadow.camera.right = 12;
    this.lamp.shadow.camera.top = 15; this.lamp.shadow.camera.bottom = -15; this.lamp.shadow.camera.far = 60; this.lamp.shadow.bias = -.0001; this.lamp.shadow.normalBias = .035;
    this.scene.add(this.lamp, this.lamp.target);
  }
  update(resolved: ResolvedExperiment, selected: string, pseudoDepth: boolean, inspectGround = true, inspectWall = false, studioLighting = false) {
    // The classroom D10 scene keeps its ray-scaled geometry, with visible surface
    // lighting. Do not add a y=0 floor: the far sphere may extend below it.
    const studio = studioLighting && !this.inspect;
    const env = studio ? { ...resolved.environment, shadows: true } : resolved.environment;
    const unlit = resolved.unlit && !studio;
    this.scene.background = new THREE.Color(this.inspect ? '#10212b' : studio || resolved.unlit ? '#263139' : background);
    this.scene.fog = !this.inspect && env.fogDensity > 0 ? new THREE.FogExp2(background, env.fogDensity) : null;
    this.scene.overrideMaterial = !this.inspect && pseudoDepth ? this.depth : null;
    this.fill.intensity = studio ? 1.1 : 2.3;
    this.lamp.intensity = studio ? 3.8 : 3;
    this.lamp.shadow.camera.left = studio ? -24 : -12;
    this.lamp.shadow.camera.right = studio ? 24 : 12;
    this.lamp.shadow.camera.top = studio ? 24 : 15;
    this.lamp.shadow.camera.bottom = studio ? -24 : -15;
    this.lamp.shadow.camera.far = studio ? 80 : 60;
    this.lamp.shadow.normalBias = studio ? .09 : .035;
    this.lamp.shadow.bias = studio ? -.00035 : -.0001;
    this.lamp.shadow.camera.updateProjectionMatrix();
    this.lamp.castShadow = !this.inspect && env.shadows;
    const signature = JSON.stringify([resolved.module, env.ground, env.grid, env.wall, env.door, env.gridSize, env.gridContrast, inspectGround, inspectWall, unlit]);
    if (signature !== this.envSignature) {
      release(this.environment); this.envSignature = signature;
      if ((this.inspect && inspectGround) || (!this.inspect && env.ground)) {
        const floor = mesh(new THREE.PlaneGeometry(80, 90), new THREE.MeshStandardMaterial({ color: this.inspect ? '#172b35' : '#788d91', roughness: .95 }), 0, -.012, -18);
        floor.rotation.x = -Math.PI / 2; floor.castShadow = false; this.environment.add(floor);
      }
      if ((this.inspect && inspectGround) || (!this.inspect && env.ground && env.grid)) {
        const spacing = this.inspect ? 2 : env.gridSize;
        const divisions = Math.ceil(80 / spacing);
        const grid = new THREE.GridHelper(divisions * spacing, divisions, this.inspect ? '#345361' : '#d4dedb', this.inspect ? '#2b4652' : '#d4dedb');
        grid.position.set(0, .006, -18); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = this.inspect ? .6 : env.gridContrast * .55;
        this.environment.add(grid);
      }
      if ((!this.inspect && env.wall) || (this.inspect && inspectWall)) {
        for (const sign of [-1, 1]) {
          const wall = mesh(new THREE.BoxGeometry(.15, 4, 35), new THREE.MeshStandardMaterial({ color: '#96a6a7', roughness: 1, side: THREE.DoubleSide, transparent: this.inspect, opacity: this.inspect ? .15 : 1 }), sign * 7, 2, -17.5); this.environment.add(wall);
        }
        const back = mesh(new THREE.BoxGeometry(14, 4, .12), new THREE.MeshStandardMaterial({ color: '#9baaaa', roughness: 1, transparent: this.inspect, opacity: this.inspect ? .15 : 1 }), 0, 2, -35); this.environment.add(back);
      }
      if (!this.inspect && env.door) {
        for (const z of [-12, -22, -32]) {
          const frameMat = new THREE.MeshStandardMaterial({ color: '#526c71', roughness: .8 });
          for (const x of [-4.6, 4.6]) this.environment.add(mesh(new THREE.BoxGeometry(.13, 3, .15), frameMat.clone(), x, 1.5, z));
          this.environment.add(mesh(new THREE.BoxGeometry(9.2, .13, .15), frameMat, 0, 3, z));
        }
      }
      if (this.inspect) {
        this.environment.add(lines([new THREE.Vector3(-5, .03, 0), new THREE.Vector3(5, .03, 0), new THREE.Vector3(0, .03, 8), new THREE.Vector3(0, .03, -40)], '#56717c', true));
      }
    }
    const present = new Set(resolved.objects.map(o => o.id));
    for (const [id, entry] of this.roots) if (!present.has(id)) { this.objects.remove(entry.root); release(entry.root); this.roots.delete(id); }
    for (const object of resolved.objects) {
      const objectSignature = JSON.stringify([object.kind, object.dimensions, object.color, unlit, selected === object.id]);
      let entry = this.roots.get(object.id);
      if (entry?.signature !== objectSignature) {
        if (entry) { this.objects.remove(entry.root); release(entry.root); }
        const root = objectRoot(object, unlit, this.inspect);
        if (object.id === selected) {
          const [w, h, d] = object.dimensions;
          const boundsGeometry = object.kind === 'card' && !this.inspect ? new THREE.PlaneGeometry(w, h) : new THREE.BoxGeometry(w + .035, h + .035, Math.max(d, .04) + .035);
          const edge = new THREE.LineSegments(new THREE.EdgesGeometry(boundsGeometry), new THREE.LineBasicMaterial({ color: '#fff2ba', transparent: true, opacity: .85 })); boundsGeometry.dispose();
          edge.position.y = h / 2; if (object.kind === 'card' && !this.inspect) edge.position.z = .0004; root.add(edge);
        }
        entry = { root, signature: objectSignature }; this.roots.set(object.id, entry); this.objects.add(root);
      }
      entry.root.position.fromArray(object.transform.position); entry.root.quaternion.fromArray(object.transform.quaternion); entry.root.scale.fromArray(object.transform.scale);
    }
    if (this.inspect) {
      const helperSignature = JSON.stringify([resolved.camera, resolved.referenceCamera, resolved.ghostObjects, resolved.objects.map(o => [o.id, o.transform]), selected]);
      if (helperSignature !== this.helperSignature) {
        release(this.helpers); this.helperSignature = helperSignature;
        this.helpers.add(cameraMarker(resolved.camera));
        if (resolved.referenceCamera) this.helpers.add(cameraMarker(resolved.referenceCamera, true));
        for (const object of resolved.objects) {
          const p = new THREE.Vector3().fromArray(worldAnchor(object, 'contact'));
          const c = new THREE.Vector3().fromArray(resolved.camera.position);
          this.helpers.add(lines([c, p], '#5cbcb8', true));
          const marker = mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: object.color }));
          marker.position.copy(p); marker.userData.objectId = object.id; this.helpers.add(marker);
        }
        for (const object of resolved.ghostObjects ?? []) {
          const [w, h, d] = object.dimensions;
          const geometry = new THREE.BoxGeometry(w, h, Math.max(d, .1)); geometry.translate(0, h / 2, 0);
          const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineDashedMaterial({ color: '#6ad7d1', dashSize: .15, gapSize: .1, opacity: .55, transparent: true })); geometry.dispose();
          ghost.position.fromArray(object.transform.position); ghost.quaternion.fromArray(object.transform.quaternion); ghost.scale.fromArray(object.transform.scale); ghost.computeLineDistances(); this.helpers.add(ghost);
        }
      }
    }
    this.scene.updateMatrixWorld(true);
  }
  dispose() { release(this.objects); release(this.environment); release(this.helpers); this.depth.dispose(); this.lamp.shadow.map?.dispose(); this.scene.clear(); }
}

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function configureInspect(camera: THREE.PerspectiveCamera, controls: OrbitControls | undefined, view: InspectView, module: string) {
  const centerZ = module === 'd12' ? -2 : -11;
  camera.up.set(0, 1, 0);
  if (view === 'top') { camera.position.set(.01, 29, centerZ + .01); camera.up.set(0, 0, -1); }
  else if (view === 'side') camera.position.set(30, 7, centerZ);
  else camera.position.set(20, 17, centerZ + 23);
  camera.lookAt(0, 0, centerZ); camera.updateMatrixWorld();
  if (controls) { controls.target.set(0, 0, centerZ); controls.enableRotate = view === 'free'; controls.screenSpacePanning = true; controls.update(); }
}

/** Exports through an isolated renderer. Direct canvas compositing preserves Three's output color transform and top-left origin. */
export async function captureExperiment(state: ExperimentState, markers = true, includeSpace = false, selected = '', view: InspectView = 'top', pseudoDepth = false, inspectSnapshot?: InspectCameraSnapshot): Promise<string> {
  const resolved = resolveExperiment(state); const rig = new SceneRig(); const space = includeSpace ? new SceneRig(true) : undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    configureRenderer(renderer); renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
    rig.update(resolved, selected, pseudoDepth); renderer.render(rig.scene, shotCamera(resolved.camera));
    const output = document.createElement('canvas'); output.width = 1920; output.height = includeSpace ? 1660 : 1080;
    const ctx = output.getContext('2d')!; ctx.fillStyle = '#10212b'; ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(renderer.domElement, 0, 0);
    if (markers) drawMeasurementOverlay(ctx, resolved, 1920, 1080);
    ctx.fillStyle = 'rgba(11,24,31,.82)'; ctx.fillRect(0, 0, 1920, 70);
    ctx.fillStyle = '#f1ecdf'; ctx.font = '28px "Microsoft YaHei", sans-serif'; ctx.fillText(`立体感知 · 空间实验室  /  ${MODULE_TITLES[state.module]}`, 30, 45);
    ctx.textAlign = 'right'; ctx.font = '24px "Microsoft YaHei", sans-serif'; ctx.fillText(`${resolved.camera.focalMm.toFixed(1)} mm  ·  36 × 20.25 mm  ·  16:9`, 1890, 44); ctx.textAlign = 'left';
    if (pseudoDepth) { ctx.fillStyle = '#10212b'; ctx.fillRect(28, 1010, 710, 45); ctx.fillStyle = '#f1ecdf'; ctx.font = '23px sans-serif'; ctx.fillText('深度伪彩 · 几何解释　青色 0m → 金色 15m → 紫色 30m+', 40, 1041); }
    if (space) {
      space.update(resolved, selected, false); renderer.setSize(1920, 540, false);
      const camera = new THREE.PerspectiveCamera(inspectSnapshot?.fov ?? 42, 1920 / 540, .1, 150);
      if (inspectSnapshot) { camera.position.fromArray(inspectSnapshot.position); camera.quaternion.fromArray(inspectSnapshot.quaternion); camera.up.fromArray(inspectSnapshot.up); camera.updateMatrixWorld(); }
      else configureInspect(camera, undefined, view, state.module);
      renderer.render(space.scene, camera);
      ctx.drawImage(renderer.domElement, 0, 1120); ctx.fillStyle = '#e7e4dc'; ctx.font = '24px "Microsoft YaHei",sans-serif'; ctx.fillText('观察空间 · 金色为拍摄相机，青色虚线为参考关系', 30, 1110);
      if (markers) for (const m of resolved.measurements) {
        const object = resolved.objects.find(o => o.id === m.id)!;
        const p = new THREE.Vector3().fromArray(worldAnchor(object, 'contact')).project(camera);
        if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z < -1 || p.z > 1) continue;
        const x = (p.x + 1) * 960, y = 1120 + (1 - p.y) * 270;
        const label = `${m.id.length < 4 ? m.id : m.label.split(' · ')[0]}  ${m.depthM.toFixed(1)}m`;
        ctx.strokeStyle = object.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '21px "Microsoft YaHei",sans-serif'; const textWidth = ctx.measureText(label).width;
        const tx = Math.min(1895 - textWidth, Math.max(20, x + 17)), ty = Math.min(1630, Math.max(1150, y));
        ctx.fillStyle = '#10212bce'; ctx.fillRect(tx - 6, ty - 23, textWidth + 12, 32); ctx.fillStyle = object.color; ctx.fillText(label, tx, ty);
      }
    }
    return output.toDataURL('image/png');
  } finally { rig.dispose(); space?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); }
}

export function projectedRightEdge(object: SceneObject, camera: ResolvedCamera) {
  const values: number[] = [];
  for (const x of [-.5, .5]) for (const y of [0, 1]) for (const z of [-.5, .5]) {
    const p = projectPoint(transformPoint([x * object.dimensions[0], y * object.dimensions[1], z * object.dimensions[2]], object.transform), camera);
    if (p.valid) values.push(p.u);
  }
  return values.length ? Math.max(...values) : .5;
}

export function projectionStatus(resolved: ResolvedExperiment) {
  const reasons = { behind: '在相机后方', near: '越过近裁切面', far: '超出远裁切面', nonfinite: '投影无效' };
  const status = resolved.measurements.filter(m => !m.inFrame).map(m => {
    const label = m.id.length < 4 ? m.id : m.label.split(' · ')[0];
    const invalid = !m.top.valid ? m.top : !m.bottom.valid ? m.bottom : null;
    return `${label} ${invalid ? reasons[invalid.reason] : m.center.valid && !m.center.inFrame ? '出框' : '部分出框'}`;
  });
  if (resolved.alignment && !resolved.alignment.visible) status.push('几何锚点不可见');
  return status.join(' · ');
}

export function drawMeasurementOverlay(ctx: CanvasRenderingContext2D, resolved: ResolvedExperiment, width: number, height: number) {
  const scale = width / 1920; ctx.save(); ctx.font = `${24 * scale}px "Microsoft YaHei", sans-serif`; ctx.lineWidth = 2 * scale;
  const status = projectionStatus(resolved);
  if (status) { ctx.fillStyle = '#253b42dd'; ctx.fillRect(24 * scale, 85 * scale, Math.min(width - 48 * scale, (status.length * 24 + 28) * scale), 42 * scale); ctx.fillStyle = '#ffe1a0'; ctx.fillText(status, 37 * scale, 115 * scale); }
  ctx.strokeStyle = '#ffffff77'; ctx.beginPath(); ctx.moveTo(width / 2 - 14 * scale, height / 2); ctx.lineTo(width / 2 + 14 * scale, height / 2); ctx.moveTo(width / 2, height / 2 - 14 * scale); ctx.lineTo(width / 2, height / 2 + 14 * scale); ctx.stroke();
  for (const m of resolved.measurements) {
    if (!m.top.valid || !m.bottom.valid || !m.center.valid) continue;
    const object = resolved.objects.find(o => o.id === m.id)!; const x = projectedRightEdge(object, resolved.camera) * width + 24 * scale, top = m.top.v * height, bottom = m.bottom.v * height;
    ctx.strokeStyle = object.color; ctx.fillStyle = object.color; ctx.setLineDash([8 * scale, 5 * scale]);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.moveTo(x - 10 * scale, top); ctx.lineTo(x + 10 * scale, top); ctx.moveTo(x - 10 * scale, bottom); ctx.lineTo(x + 10 * scale, bottom); ctx.stroke();
    ctx.setLineDash([]); const text = `${m.id.length < 4 ? m.id : m.id === 'subject' ? '主体' : m.id === 'background' ? '背景' : m.label.split(' · ')[0]}  ${m.projectedHeight === null ? '—' : (m.projectedHeight * 100).toFixed(1) + '%'}`;
    const tx = Math.min(width - 185 * scale, Math.max(12 * scale, x + 13 * scale)); const ty = Math.max(110 * scale, Math.min(height - 24 * scale, (top + bottom) / 2));
    ctx.fillStyle = 'rgba(13,29,36,.8)'; ctx.fillRect(tx - 7 * scale, ty - 27 * scale, 170 * scale, 38 * scale); ctx.fillStyle = '#fff6dd'; ctx.fillText(text, tx, ty);
    if (resolved.module === 'd09' && Math.abs(resolved.camera.position[0]) > .005) {
      const centerWorld = new THREE.Vector3().fromArray(worldAnchor(object, 'top')).add(new THREE.Vector3().fromArray(worldAnchor(object, 'bottom'))).multiplyScalar(.5).toArray() as Vec3;
      const origin = projectPoint(centerWorld, { ...resolved.camera, position: [0, resolved.camera.position[1], resolved.camera.position[2]] });
      if (origin.valid) {
        const x1 = origin.u * width, y1 = origin.v * height, x2 = m.center.u * width, y2 = m.center.v * height, angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = '#fff4d5'; ctx.beginPath(); ctx.arc(x1, y1, 6 * scale, 0, Math.PI * 2); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.moveTo(x2 - Math.cos(angle - .5) * 12 * scale, y2 - Math.sin(angle - .5) * 12 * scale); ctx.lineTo(x2, y2); ctx.lineTo(x2 - Math.cos(angle + .5) * 12 * scale, y2 - Math.sin(angle + .5) * 12 * scale); ctx.stroke();
      }
    }
  }
  const a = resolved.alignment?.a, b = resolved.alignment?.b;
  if (a?.valid && b?.valid) {
    ctx.strokeStyle = '#fff5db'; ctx.setLineDash([7 * scale, 5 * scale]); ctx.beginPath(); ctx.moveTo(a.u * width, a.v * height); ctx.lineTo(b.u * width, b.v * height); ctx.stroke(); ctx.setLineDash([]);
    for (const [p, color] of [[a, '#f1bd60'], [b, '#66d6d0']] as const) { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(p.u * width, p.v * height, 12 * scale, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#fff3d2'; ctx.fillText('几何参考点', a.u * width + 24 * scale, a.v * height - 24 * scale);
  }
  ctx.restore();
}
