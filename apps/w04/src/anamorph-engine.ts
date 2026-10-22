import * as THREE from 'three';
import { eyePosition, exportDimensions, fittedFov, MODEL_CENTER, modelPointToWorld, planeBounds, projectToPlane, type AnamorphParams, type AnamorphVec3, type PlaneBounds } from './anamorph-core';

function disposeGraph(root: THREE.Object3D, geometries = true) {
  const geometrySet = new Set<THREE.BufferGeometry>(), materialSet = new Set<THREE.Material>();
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (geometries && mesh.geometry) geometrySet.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materialSet.add(material);
  });
  geometrySet.forEach(geometry => geometry.dispose()); materialSet.forEach(material => material.dispose()); root.clear();
}

export function configureAnamorphRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
}

const vertexShader = `
  uniform mat4 imageProjection;
  varying vec4 imagePosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    imagePosition = imageProjection * world;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fragmentShader = `
  uniform sampler2D modelImage;
  varying vec4 imagePosition;
  void main() {
    if (imagePosition.w <= 0.0) discard;
    vec2 uv = imagePosition.xy / imagePosition.w * 0.5 + 0.5;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    vec4 texel = texture2D(modelImage, uv);
    if (texel.a < 0.001) discard;
    // Multisample resolve and filtering store premultiplied coverage at the silhouette.
    gl_FragColor = vec4(texel.rgb / max(texel.a, 0.0001), texel.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One baked eye image is mapped projectively onto the actual y=0 drawing plane. */
export class AnamorphRig {
  readonly sourceScene = new THREE.Scene();
  readonly planeScene = new THREE.Scene();
  readonly spaceScene = new THREE.Scene();
  readonly eyeCamera = new THREE.PerspectiveCamera(35, 1, .01, 200);
  readonly planeCamera = new THREE.OrthographicCamera(-4, 4, 4, -4, .01, 200);
  readonly sourceRoot = new THREE.Group();
  readonly ghostRoot = new THREE.Group();
  readonly helpers = new THREE.Group();
  readonly target: THREE.WebGLRenderTarget;
  readonly planeGeometry: THREE.PlaneGeometry;
  readonly planeMaterial: THREE.ShaderMaterial;
  readonly sourceMaterial: THREE.MeshStandardMaterial;
  readonly planeMesh: THREE.Mesh;
  readonly spacePlane: THREE.Mesh;
  readonly localPoints: AnamorphVec3[] = [];
  bounds!: PlaneBounds;
  eye!: AnamorphVec3;
  params: AnamorphParams;
  private grid?: THREE.GridHelper;
  private eyeMarker?: THREE.Group;

  constructor(model: THREE.Object3D, params: AnamorphParams, renderer: THREE.WebGLRenderer, resolution = 1024) {
    let meshCount = 0;
    model.traverse(node => { if ((node as THREE.Mesh).isMesh && (node as THREE.Mesh).geometry.getAttribute('position')?.count) meshCount++; });
    if (!meshCount) throw new Error('模型中没有可投影的三角网格');
    this.params = { ...params };
    this.target = new THREE.WebGLRenderTarget(resolution, resolution, {
      type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      samples: resolution <= 2048 ? Math.min(4, renderer.capabilities.maxSamples) : 0,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;
    this.sourceMaterial = new THREE.MeshStandardMaterial({ color: params.color, roughness: .58, metalness: .03, side: THREE.DoubleSide });
    const clone = model.clone(true);
    clone.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      mesh.geometry = mesh.geometry.clone(); mesh.material = this.sourceMaterial;
      mesh.castShadow = false; mesh.receiveShadow = false;
    });
    this.sourceRoot.add(clone); this.sourceScene.add(this.sourceRoot); this.sourceRoot.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#79c7d5', transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide });
    this.sourceRoot.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh, attribute = mesh.geometry.getAttribute('position');
      if (!attribute) return;
      for (let i = 0; i < attribute.count; i++) {
        point.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld);
        this.localPoints.push(point.toArray() as AnamorphVec3);
      }
      const ghost = new THREE.Mesh(mesh.geometry, ghostMaterial); ghost.applyMatrix4(mesh.matrixWorld); this.ghostRoot.add(ghost);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 42), new THREE.LineBasicMaterial({ color: '#80ccd8', transparent: true, opacity: .34, depthWrite: false }));
      edges.applyMatrix4(mesh.matrixWorld); edges.userData.ownGeometry = true; this.ghostRoot.add(edges);
    });
    this.sourceScene.add(new THREE.HemisphereLight('#f4f9ff', '#617478', 1.8));
    const key = new THREE.DirectionalLight('#fff1d7', 2.6); key.position.set(-3, 7, 5); this.sourceScene.add(key);
    const fill = new THREE.DirectionalLight('#b8d9ff', .6); fill.position.set(5, 2, -3); this.sourceScene.add(fill);
    this.planeMaterial = new THREE.ShaderMaterial({
      uniforms: { modelImage: { value: this.target.texture }, imageProjection: { value: new THREE.Matrix4() } },
      vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: true,
    });
    this.planeGeometry = new THREE.PlaneGeometry(1, 1); this.planeGeometry.rotateX(-Math.PI / 2);
    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    this.spacePlane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    this.planeScene.add(this.planeMesh); this.spaceScene.add(this.spacePlane, this.ghostRoot, this.helpers);
    this.spaceScene.background = new THREE.Color('#14232d');
    try { this.update(params); } catch (cause) { this.dispose(); throw cause; }
  }

  update(params: AnamorphParams) {
    this.params = { ...params };
    this.eye = eyePosition(params);
    const worldPoints = this.localPoints.map(point => modelPointToWorld(point, params.rotationDeg));
    this.bounds = planeBounds(worldPoints, this.eye);
    this.sourceRoot.position.fromArray(MODEL_CENTER); this.sourceRoot.rotation.y = THREE.MathUtils.degToRad(params.rotationDeg);
    this.ghostRoot.position.copy(this.sourceRoot.position); this.ghostRoot.rotation.copy(this.sourceRoot.rotation);
    this.sourceMaterial.color.set(params.color); this.sourceScene.updateMatrixWorld(true);
    this.eyeCamera.position.fromArray(this.eye); this.eyeCamera.up.set(0, 1, 0); this.eyeCamera.fov = fittedFov(params.distanceM);
    this.eyeCamera.lookAt(...MODEL_CENTER); this.eyeCamera.updateProjectionMatrix(); this.eyeCamera.updateMatrixWorld(true);
    (this.planeMaterial.uniforms.imageProjection.value as THREE.Matrix4).multiplyMatrices(this.eyeCamera.projectionMatrix, this.eyeCamera.matrixWorldInverse);
    for (const plane of [this.planeMesh, this.spacePlane]) {
      plane.position.fromArray(this.bounds.center); plane.scale.set(this.bounds.width, 1, this.bounds.height);
    }
    this.configurePlaneCamera(1);
    this.updateHelpers(worldPoints);
    this.planeScene.updateMatrixWorld(true); this.spaceScene.updateMatrixWorld(true);
  }

  configurePlaneCamera(aspect: number, extraPadding = 1.03) {
    const bounds = this.bounds;
    let width = bounds.width * extraPadding, height = bounds.height * extraPadding;
    if (width / height < aspect) width = height * aspect; else height = width / aspect;
    this.planeCamera.left = -width / 2; this.planeCamera.right = width / 2; this.planeCamera.top = height / 2; this.planeCamera.bottom = -height / 2;
    this.planeCamera.position.set(bounds.center[0], 50, bounds.center[2]); this.planeCamera.up.set(0, 0, -1);
    this.planeCamera.lookAt(...bounds.center); this.planeCamera.updateProjectionMatrix(); this.planeCamera.updateMatrixWorld(true);
  }

  bake(renderer: THREE.WebGLRenderer) {
    const previous = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(), mipmapLevel = renderer.getActiveMipmapLevel();
    const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
    try {
      // Binding the target applies its physical-pixel viewport. setViewport() would
      // multiply it by the screen pixel ratio again and crop the source image.
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.sourceScene, this.eyeCamera);
    } finally {
      renderer.setRenderTarget(previous, cubeFace, mipmapLevel);
      renderer.setClearColor(clearColor, clearAlpha);
    }
  }

  private updateHelpers(points: AnamorphVec3[]) {
    disposeGraph(this.helpers);
    if (this.grid) { this.spaceScene.remove(this.grid); this.grid.geometry.dispose(); (this.grid.material as THREE.Material).dispose(); }
    const extent = Math.max(8, this.bounds.width, this.bounds.height, this.params.distanceM) * 1.7;
    this.grid = new THREE.GridHelper(extent, 24, '#3f626f', '#2a4652');
    this.grid.position.set(this.bounds.center[0], -.012, this.bounds.center[2]);
    (this.grid.material as THREE.LineBasicMaterial).transparent = true; (this.grid.material as THREE.LineBasicMaterial).opacity = .65;
    this.spaceScene.add(this.grid);
    const minMax = [0, 1, 2].flatMap(axis => [points.reduce((a, b) => a[axis] < b[axis] ? a : b), points.reduce((a, b) => a[axis] > b[axis] ? a : b)]);
    const chosen = Array.from(new Map(minMax.map(point => [point.join(','), point])).values());
    const rays: THREE.Vector3[] = [];
    for (const point of chosen) {
      const q = projectToPlane(point, this.eye);
      rays.push(new THREE.Vector3(...this.eye), new THREE.Vector3(...q));
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#edbd69' })); marker.position.fromArray(q); this.helpers.add(marker);
    }
    this.helpers.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rays), new THREE.LineBasicMaterial({ color: '#eab85e', transparent: true, opacity: .55 })));
    const b = this.bounds;
    const corners = [new THREE.Vector3(b.minX, .005, b.minZ), new THREE.Vector3(b.maxX, .005, b.minZ), new THREE.Vector3(b.maxX, .005, b.maxZ), new THREE.Vector3(b.minX, .005, b.maxZ)];
    this.helpers.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineDashedMaterial({ color: '#9dc9d1', dashSize: .15, gapSize: .09, opacity: .65, transparent: true })).computeLineDistances());
    const eyeMarker = new THREE.Group(); this.eyeMarker = eyeMarker;
    const eyeBody = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 10), new THREE.MeshBasicMaterial({ color: '#f1c16e' })); eyeMarker.add(eyeBody);
    const lens = new THREE.Mesh(new THREE.ConeGeometry(.14, .32, 12), new THREE.MeshBasicMaterial({ color: '#e5ad4b' }));
    const forward = new THREE.Vector3(...MODEL_CENTER).sub(new THREE.Vector3(...this.eye)).normalize();
    lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward); lens.position.copy(forward).multiplyScalar(.22); eyeMarker.add(lens);
    eyeMarker.position.fromArray(this.eye); this.helpers.add(eyeMarker);
  }

  configureSpaceView(camera: THREE.PerspectiveCamera, showGhost: boolean, fromEye: boolean) {
    this.ghostRoot.visible = showGhost;
    // The eye's decorative lens sits in front of its own camera and otherwise
    // covers the restored drawing. Also suppress it when approaching manually.
    this.helpers.visible = !fromEye;
    if (this.eyeMarker) this.eyeMarker.visible = camera.position.distanceTo(this.eyeMarker.position) > .75;
  }

  spaceBounds() {
    return new THREE.Box3(new THREE.Vector3(this.bounds.minX, 0, this.bounds.minZ), new THREE.Vector3(this.bounds.maxX, 2.3, this.bounds.maxZ)).expandByPoint(new THREE.Vector3(...this.eye));
  }

  spaceFramingPoints() {
    const b = this.bounds, points = [new THREE.Vector3(...this.eye)];
    for (const x of [b.minX, b.maxX]) for (const z of [b.minZ, b.maxZ]) points.push(new THREE.Vector3(x, 0, z));
    const model = new THREE.Box3().setFromObject(this.sourceRoot);
    for (const x of [model.min.x, model.max.x]) for (const y of [model.min.y, model.max.y]) for (const z of [model.min.z, model.max.z]) points.push(new THREE.Vector3(x, y, z));
    return points;
  }

  dispose() {
    // Source geometry is shared by the ghost meshes; dispose it exactly once.
    const edgeGeometries: THREE.BufferGeometry[] = [];
    this.ghostRoot.traverse(node => { if (node.userData.ownGeometry) edgeGeometries.push((node as THREE.LineSegments).geometry); });
    disposeGraph(this.ghostRoot, false); edgeGeometries.forEach(geometry => geometry.dispose());
    disposeGraph(this.sourceRoot); disposeGraph(this.helpers);
    this.grid?.geometry.dispose(); if (this.grid) (this.grid.material as THREE.Material).dispose();
    this.planeGeometry.dispose(); this.planeMaterial.dispose(); this.target.dispose();
    this.sourceScene.clear(); this.planeScene.clear(); this.spaceScene.clear();
  }
}

/** Export re-renders at the requested resolution in an isolated scene/context. */
export async function exportAnamorphPng(model: THREE.Object3D, params: AnamorphParams, longEdge = 2048): Promise<{ url: string; width: number; height: number }> {
  let renderer: THREE.WebGLRenderer | undefined, rig: AnamorphRig | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    configureAnamorphRenderer(renderer); renderer.setPixelRatio(1);
    if (longEdge > renderer.capabilities.maxTextureSize) throw new Error('此设备不支持所选导出分辨率，请选择较小尺寸');
    rig = new AnamorphRig(model, params, renderer, longEdge);
    const dimensions = exportDimensions(rig.bounds, longEdge);
    rig.bake(renderer); rig.configurePlaneCamera(dimensions.width / dimensions.height, 1);
    renderer.setSize(dimensions.width, dimensions.height, false);
    renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, dimensions.width, dimensions.height);
    renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(rig.planeScene, rig.planeCamera);
    return { url: renderer.domElement.toDataURL('image/png'), ...dimensions };
  } finally { rig?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); }
}
