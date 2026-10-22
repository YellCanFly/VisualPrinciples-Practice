import { z } from 'zod';
import { CapsuleGeometry, Euler, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ModuleId = 'd09' | 'd10' | 'd12';
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export interface CameraInput { position: Vec3; yawDeg: number; pitchDeg: number; focalMm: number }
export interface ResolvedCamera extends CameraInput { quaternion: Quat; verticalFov: number; horizontalFov: number; near: number; far: number }
export interface Transform { position: Vec3; quaternion: Quat; scale: Vec3 }
export interface SceneObject {
  id: string; label: string; kind: 'card' | 'figure' | 'sphere' | 'support' | 'occluder' | 'frame';
  transform: Transform; dimensions: Vec3; color: string; anchors: { top: Vec3; bottom: Vec3; contact: Vec3 };
}
export interface DepthCues { ground: boolean; grid: boolean; wall: boolean; door: boolean; shadows: boolean; fogDensity: number; gridSize: number; gridContrast: number; occluder: boolean; occluderX: number; occluderWidth: number }
export interface D09State {
  module: 'd09'; presetId: string; camera: CameraInput; targetKind: 'card' | 'figure';
  targets: { id: string; x: number; depthM: number; heightM: number }[];
  sizeMode: 'free' | 'equalWorld' | 'equalImage'; masterHeightM: number; cues: DepthCues;
}
export interface D10State {
  module: 'd10'; presetId: string; camera: CameraInput; referenceCamera: CameraInput;
  objects: SceneObject[]; baselineObjects: SceneObject[];
  mode: 'free' | 'align' | 'rayScale'; phase: 'edit' | 'observe'; ndc: [number, number];
  nearDepthM: number; farDepthM: number; nearScale: number; farScale: number; k: number;
}
export type LensRig = { mode: 'zoom' | 'dolly'; distanceM: number; focalMm: number } | { mode: 'dollyZoom'; distanceM: number; lockedQ: number };
export interface D12State { module: 'd12'; presetId: string; rig: LensRig }
export type ExperimentState = D09State | D10State | D12State;
export interface Modules { d09: D09State; d10: D10State; d12: D12State }
export interface AppSave { schemaVersion: 1; appVersion: string; activeModule: ModuleId; modules: Modules }
export type ProjectionResult = { valid: true; u: number; v: number; ndc: [number, number]; depthM: number; inFrame: boolean } | { valid: false; reason: 'behind' | 'near' | 'far' | 'nonfinite'; depthM: number };
export interface ObjectMeasurement { id: string; label: string; heightM: number; depthM: number; distanceM: number; projectedHeight: number | null; top: ProjectionResult; bottom: ProjectionResult; center: ProjectionResult; transmittance: number; inFrame: boolean }
export interface Alignment { a: ProjectionResult; b: ProjectionResult; errorPx: number | null; errorHeightPercent: number | null; visible: boolean; worldGapM: number }
export interface ResolvedExperiment { module: ModuleId; camera: ResolvedCamera; objects: SceneObject[]; measurements: ObjectMeasurement[]; environment: DepthCues; alignment?: Alignment; referenceCamera?: ResolvedCamera; ghostObjects?: SceneObject[]; backgroundRatio?: number; unlit: boolean }
export interface Preset { id: string; module: ModuleId; name: string; description: string }
export interface ParameterDiff { key: string; label: string; before: string; after: string }
export const SENSOR_WIDTH = 36;
export const SENSOR_HEIGHT = 20.25;
export const DEFAULT_Q = 140 / 243;
export const IDENTITY: Quat = [0, 0, 0, 1];
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const clone = <T,>(v: T): T => structuredClone(v);

/** Shared physical mesh: a figure is exactly dimensions high and rests at local y=0. */
export function createFigureGeometry(dimensions: Vec3): BufferGeometry {
  const [w, h, d] = dimensions;
  const parts: BufferGeometry[] = [
    new SphereGeometry(h * .115, 24, 18).translate(0, h * .88, 0),
    new CapsuleGeometry(w * .22, h * .24, 6, 16).translate(0, h * .58, 0),
  ];
  for (const sign of [-1, 1]) {
    parts.push(new CapsuleGeometry(w * .105, h * .28, 4, 12).translate(sign * w * .15, h * .25, 0));
    parts.push(new CapsuleGeometry(w * .075, h * .26, 4, 12).rotateZ(sign * .13).translate(sign * w * .35, h * .55, 0));
  }
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  geometry.computeBoundingBox(); const box = geometry.boundingBox!; const size = box.getSize(new Vector3());
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.scale(w / size.x, h / size.y, d / size.z); geometry.computeBoundingBox();
  return geometry;
}
const figureVertexCache = new Map<string, Vec3[]>();
function figureVertices(dimensions: Vec3): Vec3[] {
  const key = dimensions.join(','); let vertices = figureVertexCache.get(key);
  if (!vertices) {
    const geometry = createFigureGeometry(dimensions); const positions = geometry.getAttribute('position');
    vertices = Array.from({ length: positions.count }, (_, i) => [positions.getX(i), positions.getY(i), positions.getZ(i)] as Vec3);
    geometry.dispose(); if (figureVertexCache.size >= 8) figureVertexCache.clear(); figureVertexCache.set(key, vertices);
  }
  return vertices;
}
let sphereVertexCache: Vec3[] | undefined;
function boundaryVertices(object: SceneObject): Vec3[] {
  const [w, h, d] = object.dimensions;
  if (object.kind === 'figure') return figureVertices(object.dimensions);
  // Shot cards are exact planes at z=0; inspection-only thickness is irrelevant.
  if (object.kind === 'card') return [[-w / 2, 0, 0], [w / 2, 0, 0], [-w / 2, h, 0], [w / 2, h, 0]];
  if (object.kind === 'sphere') {
    if (!sphereVertexCache) {
      const geometry = new SphereGeometry(.5, 40, 28), positions = geometry.getAttribute('position');
      sphereVertexCache = Array.from({ length: positions.count }, (_, i) => [positions.getX(i), positions.getY(i), positions.getZ(i)] as Vec3);
      geometry.dispose();
    }
    return sphereVertexCache.map(([x, y, z]) => [x * w, y * h + h / 2, z * d]);
  }
  const box = (width: number, height: number, depth: number, center: Vec3): Vec3[] => {
    const points: Vec3[] = [];
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) points.push([center[0] + x * width, center[1] + y * height, center[2] + z * depth]);
    return points;
  };
  if (object.kind === 'support') return [
    ...box(w, h * .12, Math.max(d, .5), [0, h * .94, 0]),
    ...box(w * .2, h * .78, Math.max(d * .55, .25), [0, h * .45, 0]),
    ...box(w * .8, h * .1, Math.max(d, .5), [0, h * .05, 0]),
  ];
  if (object.kind === 'frame') return [
    ...box(w, .12, d || .12, [0, h - .06, 0]),
    ...box(.12, h, d || .12, [-(w - .12) / 2, h / 2, 0]),
    ...box(.12, h, d || .12, [(w - .12) / 2, h / 2, 0]),
  ];
  return box(w, h, d, [0, h / 2, 0]);
}

const radians = (d: number) => d * Math.PI / 180;
const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const vector = (v: Vec3) => new Vector3(...v);
export function cameraQuaternion(camera: CameraInput): Quat {
  return new Quaternion().setFromEuler(new Euler(radians(camera.pitchDeg), radians(camera.yawDeg), 0, 'YXZ')).toArray() as Quat;
}
export function resolveCamera(camera: CameraInput): ResolvedCamera {
  return { ...clone(camera), quaternion: cameraQuaternion(camera), verticalFov: 2 * Math.atan(SENSOR_HEIGHT / (2 * camera.focalMm)) * 180 / Math.PI,
    horizontalFov: 2 * Math.atan(SENSOR_WIDTH / (2 * camera.focalMm)) * 180 / Math.PI, near: 0.05, far: 100 };
}
export function projectPoint(point: Vec3, camera: CameraInput): ProjectionResult {
  const local = vector(point).sub(vector(camera.position)).applyQuaternion(new Quaternion(...cameraQuaternion(camera)).invert());
  return projectCameraLocal(local, camera.focalMm);
}
function projectCameraLocal(local: Vector3, focalMm: number): ProjectionResult {
  const depthM = -local.z;
  if (![local.x, local.y, depthM, focalMm].every(Number.isFinite)) return { valid: false, reason: 'nonfinite', depthM };
  if (depthM <= 0) return { valid: false, reason: 'behind', depthM };
  if (depthM < 0.05) return { valid: false, reason: 'near', depthM };
  if (depthM > 100) return { valid: false, reason: 'far', depthM };
  const u = 0.5 + focalMm * local.x / (SENSOR_WIDTH * depthM);
  const v = 0.5 - focalMm * local.y / (SENSOR_HEIGHT * depthM);
  return { valid: true, u, v, ndc: [2 * u - 1, 1 - 2 * v], depthM, inFrame: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
}
export function transformPoint(point: Vec3, transform: Transform): Vec3 {
  return tuple(vector(point).multiply(vector(transform.scale)).applyQuaternion(new Quaternion(...transform.quaternion)).add(vector(transform.position)));
}
export function worldAnchor(object: SceneObject, anchor: 'top' | 'bottom' | 'contact'): Vec3 { return transformPoint(object.anchors[anchor], object.transform); }
export function measureProjectedHeight(top: Vec3, bottom: Vec3, camera: CameraInput): number | null {
  const a = projectPoint(top, camera), b = projectPoint(bottom, camera);
  return a.valid && b.valid ? Math.abs(a.v - b.v) : null;
}
export function solveAlignedRoot(camera: CameraInput, ndc: [number, number], depthM: number, localAnchor: Vec3, rotation: Quat = IDENTITY, scale: Vec3 = [1, 1, 1]): Vec3 {
  const local = new Vector3(ndc[0] * depthM * SENSOR_WIDTH / (2 * camera.focalMm), ndc[1] * depthM * SENSOR_HEIGHT / (2 * camera.focalMm), -depthM);
  const anchor = vector(localAnchor).multiply(vector(scale)).applyQuaternion(new Quaternion(...rotation));
  return tuple(local.applyQuaternion(new Quaternion(...cameraQuaternion(camera))).add(vector(camera.position)).sub(anchor));
}
export function scaleAroundCamera(camera: CameraInput, transform: Transform, k: number): Transform {
  return { position: tuple(vector(transform.position).sub(vector(camera.position)).multiplyScalar(k).add(vector(camera.position))), quaternion: [...transform.quaternion], scale: transform.scale.map(s => s * k) as Vec3 };
}
export function solveDollyFocal(distanceM: number, heightM: number, lockedQ: number): number { return lockedQ * SENSOR_HEIGHT * distanceM / heightM; }
export function getDollyDistanceBounds(focalBounds: [number, number] = [18, 100], distanceBounds: [number, number] = [3, 18], heightM = 2, lockedQ = DEFAULT_Q): [number, number] {
  return [Math.max(distanceBounds[0], focalBounds[0] * heightM / (lockedQ * SENSOR_HEIGHT)), Math.min(distanceBounds[1], focalBounds[1] * heightM / (lockedQ * SENSOR_HEIGHT))];
}
export const DEFAULT_CUES: DepthCues = { ground: true, grid: true, wall: true, door: true, shadows: true, fogDensity: 0, gridSize: 1, gridContrast: .45, occluder: false, occluderX: 0, occluderWidth: .9 };
const cameraAt = (position: Vec3, focalMm = 35): CameraInput => ({ position, yawDeg: 0, pitchDeg: 0, focalMm });
function makeObject(id: string, label: string, kind: SceneObject['kind'], position: Vec3, dimensions: Vec3, color: string, scale = 1): SceneObject {
  return { id, label, kind, dimensions, color, transform: { position, quaternion: [...IDENTITY], scale: [scale, scale, scale] },
    anchors: { bottom: [0, 0, 0], top: [0, dimensions[1], 0], contact: [0, kind === 'support' ? dimensions[1] : 0, 0] } };
}
function defaultD09(): D09State {
  return { module: 'd09', presetId: 'd09-full', camera: cameraAt([0, 1.6, 0]), targetKind: 'card', targets: [
    { id: 'A', x: -1, depthM: 6, heightM: 1.4 }, { id: 'B', x: 0, depthM: 10, heightM: 1.4 }, { id: 'C', x: 1.25, depthM: 16, heightM: 1.4 }
  ], sizeMode: 'free', masterHeightM: 1.4, cues: clone(DEFAULT_CUES) };
}
function defaultD10(): D10State {
  const camera = cameraAt([0, 1.6, 0]);
  const objects = [makeObject('support', 'A · 近处托架', 'support', [0, 0, -6], [1.2, 1.1, .65], '#5fc7cd'), makeObject('sphere', 'B · 远处球体', 'sphere', [0, 0, -18], [1, 1, 1], '#f2c35e', 1.8)];
  const ndc: [number, number] = [0, -2 * 35 * .5 / (SENSOR_HEIGHT * 6)];
  const state: D10State = { module: 'd10', presetId: 'd10-contact', camera: clone(camera), referenceCamera: clone(camera), objects, baselineObjects: clone(objects), mode: 'align', phase: 'edit', ndc, nearDepthM: 6, farDepthM: 18, nearScale: 1, farScale: 1.8, k: 1 };
  state.objects = resolvedD10Objects(state);
  state.baselineObjects = clone(state.objects);
  return state;
}
function defaultD12(): D12State { return { module: 'd12', presetId: 'd12-dolly-zoom', rig: { mode: 'dollyZoom', distanceM: 6, lockedQ: DEFAULT_Q } }; }
export const PRESETS: Preset[] = [
  { id: 'd09-full', module: 'd09', name: '完整片场', description: '网格、阴影与门框，共同构成深度。' },
  { id: 'd09-minimal', module: 'd09', name: '少参照', description: '位置不变，同时移除多种环境线索。' },
  { id: 'd09-equal-image', module: 'd09', name: '画面一样大', description: '按深度补偿真实尺寸，保持画面高度相等。' },
  { id: 'd09-conflict', module: 'd09', name: '大小与远近竞争', description: '远处物体更大，横移寻找其他深度线索。' },
  { id: 'd10-contact', module: 'd10', name: '远球与近托架', description: '两个接触点对齐，几何相距十二米。' },
  { id: 'd10-giants', module: 'd10', name: '巨人与小人', description: '同样高的人偶，近远产生三倍画面差异。' },
  { id: 'd10-ray-scale', module: 'd10', name: '同画面，不同尺寸', description: '沿参考视线移动并缩放，保持几何投影。' },
  { id: 'd10-view-shift', module: 'd10', name: '从转向到换位', description: '冻结机关，比较转向、变焦与横移。' },
  { id: 'd12-zoom', module: 'd12', name: '原地换镜头', description: '固定机位，只改变焦距与取景范围。' },
  { id: 'd12-dolly', module: 'd12', name: '固定镜头移动', description: '焦距不变，移动机位观察前后比例。' },
  { id: 'd12-dolly-zoom', module: 'd12', name: '主体不变，背景变化', description: '距离驱动焦距，体验推拉变焦。' },
  { id: 'd12-crop', module: 'd12', name: '广角裁切与长焦', description: '同机位比较 35 mm 与 70 mm 的中央裁切。' },
];
export function loadPreset(id: string): ExperimentState {
  if (!PRESETS.some(p => p.id === id)) throw new Error('未知预设');
  if (id.startsWith('d09')) {
    const state = defaultD09(); state.presetId = id;
    if (id === 'd09-minimal') Object.assign(state.cues, { ground: false, wall: false, door: false, shadows: false });
    if (id === 'd09-equal-image') state.sizeMode = 'equalImage';
    if (id === 'd09-conflict') state.targets.forEach((target, i) => { target.heightM = [.8, 1.4, 2.8][i]; });
    return state;
  }
  if (id.startsWith('d10')) {
    const state = defaultD10(); state.presetId = id;
    if (id === 'd10-giants') {
      state.mode = 'free'; state.nearScale = state.farScale = 1;
      state.objects = [makeObject('support', 'A · 近处人偶', 'figure', [-.8, 0, -6], [.8, 1.4, .36], '#5fc7cd'), makeObject('sphere', 'B · 远处人偶', 'figure', [1.5, 0, -18], [.8, 1.4, .36], '#f2c35e')];
    }
    if (id === 'd10-ray-scale') state.mode = 'rayScale';
    if (id === 'd10-view-shift') state.phase = 'observe';
    state.baselineObjects = clone(state.objects);
    return state;
  }
  const state = defaultD12(); state.presetId = id;
  if (id !== 'd12-dolly-zoom') state.rig = { mode: id === 'd12-dolly' ? 'dolly' : 'zoom', distanceM: 6, focalMm: 35 };
  return state;
}
export function createDefaultSave(): AppSave { return { schemaVersion: 1, appVersion: '1.0.0', activeModule: 'd09', modules: { d09: defaultD09(), d10: defaultD10(), d12: defaultD12() } }; }
function resolvedD10Objects(state: D10State): SceneObject[] {
  if (state.phase === 'observe' || state.mode === 'free') return clone(state.objects);
  if (state.mode === 'rayScale') return state.baselineObjects.map((object, i) => ({ ...clone(object), transform: i === 1 ? scaleAroundCamera(state.referenceCamera, object.transform, state.k) : clone(object.transform) }));
  return state.objects.map((object, i) => {
    const scale = i === 0 ? state.nearScale : state.farScale;
    const out = clone(object); out.transform.scale = [scale, scale, scale];
    out.transform.position = solveAlignedRoot(state.referenceCamera, state.ndc, i === 0 ? state.nearDepthM : state.farDepthM, out.anchors.contact, out.transform.quaternion, out.transform.scale);
    return out;
  });
}
export function resolveShotCamera(state: ExperimentState): ResolvedCamera {
  if (state.module !== 'd12') return resolveCamera(state.camera);
  const focal = state.rig.mode === 'dollyZoom' ? solveDollyFocal(state.rig.distanceM, 2, state.rig.lockedQ) : state.rig.focalMm;
  return resolveCamera(cameraAt([0, 1, state.rig.distanceM], focal));
}
export function alignmentFor(objects: SceneObject[], camera: CameraInput): Alignment {
  const pa = worldAnchor(objects[0], 'contact'), pb = worldAnchor(objects[1], 'contact');
  const a = projectPoint(pa, camera), b = projectPoint(pb, camera);
  const errorPx = a.valid && b.valid ? Math.hypot(1920 * (a.u - b.u), 1080 * (a.v - b.v)) : null;
  return { a, b, errorPx, errorHeightPercent: errorPx === null ? null : 100 * errorPx / 1080, visible: a.valid && b.valid && a.inFrame && b.inFrame, worldGapM: vector(pa).distanceTo(vector(pb)) };
}
export function resolveExperiment(state: ExperimentState): ResolvedExperiment {
  const camera = resolveShotCamera(state);
  let objects: SceneObject[] = [];
  let environment = clone(DEFAULT_CUES);
  if (state.module === 'd09') {
    environment = clone(state.cues);
    objects = state.targets.map((target, i) => {
      const height = state.sizeMode === 'equalImage' ? 1.4 * target.depthM / 10 : state.sizeMode === 'equalWorld' ? state.masterHeightM : target.heightM;
      return makeObject(target.id, target.id, state.targetKind, [target.x, 0, -target.depthM], [.8, 1.4, state.targetKind === 'card' ? .04 : .36], ['#e6bb68', '#67c6cf', '#d88c86'][i], height / 1.4);
    });
    if (environment.occluder) objects.push(makeObject('occluder', '遮挡板', 'occluder', [environment.occluderX, 0, -8], [environment.occluderWidth, 2, .1], '#64758a'));
  } else if (state.module === 'd10') {
    objects = resolvedD10Objects(state);
    environment = { ...environment, wall: false, door: false, ground: state.mode !== 'rayScale', grid: state.mode !== 'rayScale', shadows: state.mode !== 'rayScale' };
  } else {
    objects = [makeObject('subject', '主体 · 2 m', 'card', [0, 0, 0], [.85, 2, .04], '#f2c35e'), makeObject('background', '背景 · 2 m', 'card', [3, 0, -8], [1.8, 2, .04], '#61c1cb')];
    environment = { ...environment, wall: false, door: true };
  }
  const measurements = objects.filter(o => o.id !== 'occluder').map(object => {
    const topWorld = worldAnchor(object, 'top'), bottomWorld = worldAnchor(object, 'bottom');
    const centerWorld = tuple(vector(topWorld).add(vector(bottomWorld)).multiplyScalar(.5));
    let top = projectPoint(topWorld, camera), bottom = projectPoint(bottomWorld, camera);
    const center = projectPoint(centerWorld, camera);
    // Figure bounds come from the exact shared rendered vertices, not a planar formula.
    let projectedHeight = measureProjectedHeight(topWorld, bottomWorld, camera);
    const scratch = new Vector3(), scale = vector(object.transform.scale), rotation = new Quaternion(...object.transform.quaternion), position = vector(object.transform.position), cameraPosition = vector(camera.position), inverseCamera = new Quaternion(...camera.quaternion).invert();
    const boundary = boundaryVertices(object).map(vertex => {
      scratch.fromArray(vertex).multiply(scale).applyQuaternion(rotation).add(position).sub(cameraPosition).applyQuaternion(inverseCamera);
      return projectCameraLocal(scratch, camera.focalMm);
    });
    if (object.kind === 'figure') {
      if (boundary.every(p => p.valid)) {
        const visible = boundary.filter((p): p is Extract<ProjectionResult, { valid: true }> => p.valid);
        top = visible.reduce((a, b) => a.v < b.v ? a : b); bottom = visible.reduce((a, b) => a.v > b.v ? a : b);
        projectedHeight = bottom.v - top.v;
      } else projectedHeight = null;
    }
    return { id: object.id, label: object.label, heightM: vector(topWorld).distanceTo(vector(bottomWorld)), depthM: center.depthM, distanceM: vector(centerWorld).distanceTo(vector(camera.position)), projectedHeight, top, bottom, center, transmittance: Math.exp(-Math.pow(environment.fogDensity * Math.max(0, center.depthM), 2)), inFrame: boundary.every(point => point.valid && point.inFrame) };
  });
  return { module: state.module, camera, objects, measurements, environment, unlit: state.module === 'd10' && state.mode === 'rayScale',
    ...(state.module === 'd10' ? { alignment: alignmentFor(objects, camera), referenceCamera: resolveCamera(state.referenceCamera), ghostObjects: state.mode === 'rayScale' ? clone(state.baselineObjects) : undefined } : {}),
    ...(state.module === 'd12' ? { backgroundRatio: state.rig.distanceM / (state.rig.distanceM + 8) } : {}) };
}
export function setD09SizeMode(state: D09State, sizeMode: D09State['sizeMode']): D09State {
  const next = clone(state); const measurements = resolveExperiment(state).measurements;
  next.targets.forEach((target, i) => { target.heightM = measurements[i].heightM; });
  next.sizeMode = sizeMode === 'equalImage' && next.targetKind === 'figure' ? 'free' : sizeMode;
  if (sizeMode === 'equalWorld') next.masterHeightM = next.targets[0].heightM;
  return next;
}
export function setD09TargetKind(state: D09State, targetKind: D09State['targetKind']): D09State {
  const next = state.sizeMode === 'equalImage' && targetKind === 'figure' ? setD09SizeMode(state, 'free') : clone(state); next.targetKind = targetKind; return next;
}
function freezeD10(state: D10State): D10State {
  const next = clone(state); next.objects = resolvedD10Objects(state); next.baselineObjects = clone(next.objects); next.k = 1;
  const a = projectPoint(worldAnchor(next.objects[0], 'contact'), next.referenceCamera), b = projectPoint(worldAnchor(next.objects[1], 'contact'), next.referenceCamera);
  next.nearDepthM = a.depthM; next.farDepthM = b.depthM;
  next.nearScale = next.objects[0].transform.scale[1]; next.farScale = next.objects[1].transform.scale[1];
  if (a.valid) next.ndc = a.ndc.map(value => clamp(value, -1, 1)) as [number, number];
  return next;
}
export function setD10Mode(state: D10State, mode: D10State['mode']): D10State {
  const next = freezeD10(state); next.mode = mode; next.phase = 'edit';
  if (state.phase === 'observe') next.camera = clone(next.referenceCamera);
  return next;
}
export function setD10Phase(state: D10State, phase: D10State['phase']): D10State {
  if (state.phase === phase) return clone(state);
  const next = freezeD10(state); next.phase = phase;
  if (phase === 'edit') { next.mode = 'free'; next.camera = clone(next.referenceCamera); }
  return next;
}
export function captureReference(state: D10State): D10State {
  const next = freezeD10(state); next.referenceCamera = clone(state.camera); next.mode = 'free';
  return freezeD10(next);
}
export function setD10Ndc(state: D10State, ndc: [number, number]): D10State {
  const next = clone(state); next.ndc = ndc.map(v => clamp(v, -1, 1)) as [number, number]; return next;
}
export function setD10Geometry(state: D10State, field: 'nearDepthM' | 'farDepthM' | 'nearScale' | 'farScale', value: number): D10State {
  if (state.phase === 'observe' || state.mode === 'rayScale') return clone(state);
  const next = clone(state); next[field] = value;
  if (next.mode === 'free') {
    const index = field.startsWith('near') ? 0 : 1; const object = next.objects[index];
    const p = projectPoint(worldAnchor(object, 'contact'), next.referenceCamera);
    if (field.endsWith('Scale')) object.transform.scale = [value, value, value];
    if (p.valid) object.transform.position = solveAlignedRoot(next.referenceCamera, p.ndc, index === 0 ? next.nearDepthM : next.farDepthM, object.anchors.contact, object.transform.quaternion, object.transform.scale);
    next.baselineObjects = clone(next.objects);
  }
  return next;
}
export function moveObject(state: ExperimentState, id: string, position: Vec3): ExperimentState {
  if (state.module === 'd12') return clone(state);
  if (state.module === 'd09') {
    const next = clone(state); const target = next.targets.find(t => t.id === id);
    if (target) { target.x = clamp(position[0], -8, 8); target.depthM = clamp(-position[2], 3, 24); }
    if (id === 'occluder') next.cues.occluderX = clamp(position[0], -2, 2);
    return next;
  }
  if (state.phase === 'observe') return clone(state);
  const next = setD10Mode(state, 'free'); const object = next.objects.find(o => o.id === id);
  if (object) object.transform.position = position.map(v => clamp(v, -60, 60)) as Vec3;
  return freezeD10(next);
}
export function setLensMode(state: D12State, mode: LensRig['mode']): D12State {
  const next = clone(state); const camera = resolveShotCamera(state);
  next.rig = mode === 'dollyZoom' ? { mode, distanceM: state.rig.distanceM, lockedQ: camera.focalMm * 2 / (SENSOR_HEIGHT * state.rig.distanceM) } : { mode, distanceM: state.rig.distanceM, focalMm: camera.focalMm };
  return next;
}
export function setDollyDistance(state: D12State, distanceM: number): D12State {
  const next = clone(state); const bounds = state.rig.mode === 'dollyZoom' ? getDollyDistanceBounds([18, 100], [3, 18], 2, state.rig.lockedQ) : [3, 18];
  next.rig.distanceM = clamp(distanceM, bounds[0], bounds[1]); return next;
}
export function sampleAnimation(start: ExperimentState, time: number): ExperimentState {
  const t = clamp(time, 0, 1);
  if (start.module === 'd09') { const next = clone(start); next.camera.position[0] = -.8 + 1.6 * t; return next; }
  if (start.module === 'd10') {
    const next = setD10Phase(start, 'observe'); next.camera = clone(start.referenceCamera);
    next.camera.position = tuple(new Vector3(.5 * t, 0, 0).applyQuaternion(new Quaternion(...cameraQuaternion(start.referenceCamera))).add(vector(start.referenceCamera.position))); return next;
  }
  const next = setLensMode(start, 'dollyZoom'); const rig = next.rig as Extract<LensRig, { mode: 'dollyZoom' }>;
  const bounds = getDollyDistanceBounds([18, 100], [3, 18], 2, rig.lockedQ);
  const from = clamp(6, bounds[0], bounds[1]), to = clamp(12, bounds[0], bounds[1]);
  rig.distanceM = from + (to - from) * t; return next;
}
export function errorMap(state: D10State): { x: number; y: number; errorPx: number | null; valid: boolean }[] {
  const objects = resolvedD10Objects(state); const quaternion = new Quaternion(...cameraQuaternion(state.referenceCamera));
  return Array.from({ length: 441 }, (_, i) => {
    const x = (i % 21 - 10) / 20, y = (Math.floor(i / 21) - 10) / 20;
    const camera = clone(state.referenceCamera); camera.position = tuple(new Vector3(x, y, 0).applyQuaternion(quaternion).add(vector(camera.position)));
    const alignment = alignmentFor(objects, camera); return { x, y, errorPx: alignment.errorPx, valid: alignment.visible };
  });
}
export function cameraAtMapPoint(state: D10State, x: number, y: number): D10State {
  const next = setD10Phase(state, 'observe'); next.camera = clone(state.referenceCamera);
  next.camera.position = tuple(new Vector3(x, y, 0).applyQuaternion(new Quaternion(...cameraQuaternion(state.referenceCamera))).add(vector(state.referenceCamera.position))); return next;
}

const numeric = (min: number, max: number) => z.number().finite().min(min).max(max);
const vecSchema = z.tuple([numeric(-100, 100), numeric(-100, 100), numeric(-100, 100)]);
const quatSchema = z.tuple([numeric(-1, 1), numeric(-1, 1), numeric(-1, 1), numeric(-1, 1)]).refine(q => Math.abs(Math.hypot(...q) - 1) < 1e-6, '旋转四元数须归一化');
const cameraSchema = z.object({ position: vecSchema, yawDeg: numeric(-180, 180), pitchDeg: numeric(-89, 89), focalMm: numeric(18, 100) }).strict();
const positiveVecSchema = z.tuple([numeric(.001, 20), numeric(.001, 20), numeric(.001, 20)]);
const objectSchema = z.object({
  id: z.enum(['support', 'sphere']), label: z.string().max(40), kind: z.enum(['card', 'figure', 'sphere', 'support', 'occluder', 'frame']),
  transform: z.object({ position: vecSchema, quaternion: quatSchema, scale: positiveVecSchema }).strict(),
  dimensions: positiveVecSchema, color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  anchors: z.object({ top: vecSchema, bottom: vecSchema, contact: vecSchema }).strict(),
}).strict();
const d09Schema = z.object({
  module: z.literal('d09'), presetId: z.enum(['d09-full', 'd09-minimal', 'd09-equal-image', 'd09-conflict']), camera: cameraSchema,
  targetKind: z.enum(['card', 'figure']), sizeMode: z.enum(['free', 'equalWorld', 'equalImage']), masterHeightM: numeric(.4, 4),
  targets: z.array(z.object({ id: z.enum(['A', 'B', 'C']), x: numeric(-8, 8), depthM: numeric(3, 24), heightM: numeric(.4, 4) }).strict()).length(3),
  cues: z.object({ ground: z.boolean(), grid: z.boolean(), wall: z.boolean(), door: z.boolean(), shadows: z.boolean(), fogDensity: numeric(0, .08), gridSize: numeric(.25, 2), gridContrast: numeric(0, 1), occluder: z.boolean(), occluderX: numeric(-2, 2), occluderWidth: numeric(.2, 1.8) }).strict(),
}).strict().superRefine((s, ctx) => {
  if (s.targets.map(t => t.id).join(',') !== 'A,B,C') ctx.addIssue({ code: 'custom', message: '目标必须按 A、B、C 唯一排列' });
  if (s.targetKind === 'figure' && s.sizeMode === 'equalImage') ctx.addIssue({ code: 'custom', message: '人偶不能启用平面高度补偿' });
  if (s.camera.yawDeg !== 0 || s.camera.pitchDeg !== 0 || s.camera.position[2] !== 0 || s.camera.position[1] !== 1.6 || Math.abs(s.camera.position[0]) > 1) ctx.addIssue({ code: 'custom', message: 'D09 相机仅支持固定朝向横移 ±1 m' });
});
const d10Schema = z.object({
  module: z.literal('d10'), presetId: z.enum(['d10-contact', 'd10-giants', 'd10-ray-scale', 'd10-view-shift']), camera: cameraSchema, referenceCamera: cameraSchema,
  objects: z.array(objectSchema).length(2), baselineObjects: z.array(objectSchema).length(2),
  mode: z.enum(['free', 'align', 'rayScale']), phase: z.enum(['edit', 'observe']), ndc: z.tuple([numeric(-1, 1), numeric(-1, 1)]),
  nearDepthM: numeric(.1, 80), farDepthM: numeric(.1, 80), nearScale: numeric(.01, 20), farScale: numeric(.01, 20), k: numeric(.5, 2),
}).strict().superRefine((s, ctx) => {
  if ([s.objects, s.baselineObjects].some(objects => objects.map(o => o.id).join(',') !== 'support,sphere')) ctx.addIssue({ code: 'custom', message: 'D10 对象必须为近处对象、远处对象的固定配对' });
  if (s.mode === 'align' && s.phase === 'edit' && s.farDepthM - s.nearDepthM < 2) ctx.addIssue({ code: 'custom', message: '对齐时远近锚点至少间隔 2 m' });
  if (s.mode === 'rayScale' && s.phase === 'edit') {
    const objects = resolvedD10Objects(s as D10State);
    for (const o of objects) for (const x of [-.5, .5]) for (const y of [0, 1]) for (const zz of [-.5, .5]) {
      const p = projectPoint(transformPoint([x * o.dimensions[0], y * o.dimensions[1], zz * o.dimensions[2]], o.transform), s.referenceCamera);
      if (!p.valid) { ctx.addIssue({ code: 'custom', message: '投影保持后的几何超出参考相机裁切范围' }); return; }
    }
  }
});
const lensRigSchema = z.union([
  z.object({ mode: z.enum(['zoom', 'dolly']), distanceM: numeric(3, 18), focalMm: numeric(18, 100) }).strict(),
  z.object({ mode: z.literal('dollyZoom'), distanceM: numeric(3, 18), lockedQ: numeric(.01, 4) }).strict(),
]);
const d12Schema = z.object({ module: z.literal('d12'), presetId: z.enum(['d12-zoom', 'd12-dolly', 'd12-dolly-zoom', 'd12-crop']), rig: lensRigSchema }).strict().superRefine((s, ctx) => {
  if (s.rig.mode === 'dollyZoom') {
    const f = solveDollyFocal(s.rig.distanceM, 2, s.rig.lockedQ);
    if (f < 18 - 1e-9 || f > 100 + 1e-9) ctx.addIssue({ code: 'custom', message: '联动焦距超出 18–100 mm；请恢复有效状态或关闭联动' });
  }
});
export const experimentSchema = z.union([d09Schema, d10Schema, d12Schema]);
export const saveSchema = z.object({ schemaVersion: z.literal(1), appVersion: z.string().max(30), activeModule: z.enum(['d09', 'd10', 'd12']), modules: z.object({ d09: d09Schema, d10: d10Schema, d12: d12Schema }).strict() }).strict();
export const moduleSaveSchema = z.object({ schemaVersion: z.literal(1), appVersion: z.string().max(30), experiment: experimentSchema }).strict();
function decodedInput(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  if (new TextEncoder().encode(input).length > 256 * 1024) throw new Error('文件超过 256 KB 上限');
  try { return JSON.parse(input); } catch { throw new Error('不是有效的 JSON 数据'); }
}
function validated<T>(schema: z.ZodType, input: unknown): T {
  const result = schema.safeParse(decodedInput(input));
  if (!result.success) {
    const issue = result.error.issues[0]; throw new Error(`实验数据无效：${issue.path.join('.') || '结构或版本'} · ${issue.message}`);
  }
  return result.data as T;
}
export function parseExperiment(input: unknown): ExperimentState { return validated<ExperimentState>(experimentSchema, input); }
export function parseSave(input: unknown): AppSave { return validated<AppSave>(saveSchema, input); }
export function parseModuleSave(input: unknown): ExperimentState {
  return validated<{ schemaVersion: 1; appVersion: string; experiment: ExperimentState }>(moduleSaveSchema, input).experiment;
}
export function encodeShare(state: ExperimentState): string {
  const data = JSON.stringify({ v: 1, state: parseExperiment(state) });
  const bytes = new TextEncoder().encode(data);
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = `#m=${state.module}&v=1&s=${encoded}`;
  if (hash.length > 8192) throw new Error('自定义链接超过 8 KB，请使用 JSON 导出');
  return hash;
}
export function decodeShare(hash: string): ExperimentState | null {
  if (!hash || hash === '#') return null;
  if (hash.length > 8192) throw new Error('分享链接超过 8 KB');
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('v') !== '1') throw new Error('不支持的分享链接版本');
  const encoded = params.get('s');
  if (!encoded) {
    const moduleId = params.get('m'); const defaults: Record<string, string> = { d09: 'd09-full', d10: 'd10-contact', d12: 'd12-dolly-zoom' };
    const state = loadPreset(params.get('p') || defaults[moduleId || ''] || '');
    if (moduleId && state.module !== moduleId) throw new Error('链接的模块与预设不一致');
    return state;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
    const wrapper = z.object({ v: z.literal(1), state: experimentSchema }).strict().parse(JSON.parse(text));
    if (params.get('m') !== wrapper.state.module) throw new Error('模块不一致');
    return wrapper.state as ExperimentState;
  } catch { throw new Error('分享链接损坏或包含无效实验参数'); }
}
const LABELS: Record<string, string> = {
  focalMm: '焦距 / mm', distanceM: '相机距离 / m', lockedQ: '锁定画面高度', mode: '编辑模式', phase: '摆拍 / 观察', sizeMode: '尺寸关系', targetKind: '目标形态', masterHeightM: '统一实际高度 / m',
  ground: '地面', grid: '地面网格', wall: '侧墙', door: '门框', shadows: '投射阴影', fogDensity: '雾密度', gridSize: '网格尺寸 / m', gridContrast: '网格对比度', occluder: '遮挡板', occluderX: '遮挡板位置 / m', occluderWidth: '遮挡板宽度 / m',
  yawDeg: '偏航 / °', pitchDeg: '俯仰 / °', nearDepthM: '近锚点深度 / m', farDepthM: '远锚点深度 / m', nearScale: '近物体倍数', farScale: '远物体倍数', k: '射线尺度', heightM: '高度 / m', depthM: '深度 / m', x: '横向位置 / m',
};
function flatten(value: unknown, prefix = '', output: Record<string, string> = {}): Record<string, string> {
  if (value === undefined) return output;
  if (value && typeof value === 'object') {
    if (Array.isArray(value) && value.every(v => typeof v === 'number')) output[prefix] = value.map(v => Number(v.toFixed(5))).join(', ');
    else Object.entries(value).forEach(([key, item]) => { if (!['presetId', 'label', 'color', 'baselineObjects'].includes(key)) flatten(item, prefix ? `${prefix}.${key}` : key, output); });
  } else output[prefix] = typeof value === 'number' ? String(Number(value.toFixed(6))) : typeof value === 'boolean' ? value ? '开' : '关' : String(value);
  return output;
}
export function compareSnapshots(a: ExperimentState, b: ExperimentState): ParameterDiff[] {
  const before = flatten(a), after = flatten(b);
  const ra = resolveExperiment(a), rb = resolveExperiment(b);
  before['derived.focalMm'] = ra.camera.focalMm.toFixed(3); after['derived.focalMm'] = rb.camera.focalMm.toFixed(3);
  before['derived.backgroundRatio'] = ra.backgroundRatio?.toFixed(6) || ''; after['derived.backgroundRatio'] = rb.backgroundRatio?.toFixed(6) || '';
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(key => before[key] !== after[key]).map(key => ({ key, label: key === 'derived.focalMm' ? '解析焦距 / mm' : key === 'derived.backgroundRatio' ? '背景 / 主体高度比' : `${LABELS[key.split('.').at(-1)!] || key}${key.startsWith('targets.') ? ` · ${['A', 'B', 'C'][Number(key.split('.')[1])]}` : ''}`, before: before[key] ?? '—', after: after[key] ?? '—' }));
}
