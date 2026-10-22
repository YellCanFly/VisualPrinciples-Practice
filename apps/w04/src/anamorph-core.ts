import { Vector3 } from 'three';

export type AnamorphVec3 = [number, number, number];
export type BuiltinModelId = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'torusKnot' | 'tetrahedron' | 'octahedron' | 'icosahedron' | 'bunny' | 'teapot' | 'monkey';
export interface AnamorphParams {
  modelId: BuiltinModelId | 'fbx';
  azimuthDeg: number;
  elevationDeg: number;
  distanceM: number;
  rotationDeg: number;
  color: string;
}
export interface PlaneBounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
  width: number; height: number; center: AnamorphVec3;
}
export const MODEL_CENTER: AnamorphVec3 = [0, 1.2, 0];
export const ANAMORPH_DEFAULTS: AnamorphParams = { modelId: 'box', azimuthDeg: 35, elevationDeg: 25, distanceM: 7, rotationDeg: 0, color: '#78b9ce' };
export const MODEL_OPTIONS: { id: BuiltinModelId; label: string }[] = [
  { id: 'box', label: '立方体' }, { id: 'sphere', label: '球体' }, { id: 'cylinder', label: '圆柱' },
  { id: 'cone', label: '圆锥' }, { id: 'torus', label: '圆环' }, { id: 'torusKnot', label: '圆环结' },
  { id: 'tetrahedron', label: '四面体' }, { id: 'octahedron', label: '八面体' }, { id: 'icosahedron', label: '二十面体' },
  { id: 'bunny', label: 'Stanford 兔子' }, { id: 'teapot', label: 'Utah 茶壶' }, { id: 'monkey', label: 'Suzanne 猴头' },
];
const rad = (degrees: number) => degrees * Math.PI / 180;
const finitePoint = (point: AnamorphVec3) => point.every(Number.isFinite);

export function validateAnamorphParams(value: unknown): AnamorphParams {
  const p = value as AnamorphParams;
  if (!p || typeof p !== 'object' || ![...MODEL_OPTIONS.map(o => o.id), 'fbx'].includes(p.modelId) ||
    !Number.isFinite(p.azimuthDeg) || p.azimuthDeg < -180 || p.azimuthDeg > 180 ||
    !Number.isFinite(p.elevationDeg) || p.elevationDeg < 15 || p.elevationDeg > 75 ||
    !Number.isFinite(p.distanceM) || p.distanceM < 5 || p.distanceM > 12 ||
    !Number.isFinite(p.rotationDeg) || p.rotationDeg < -180 || p.rotationDeg > 180 ||
    typeof p.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.color)) throw new Error('反透视参数无效');
  return { modelId: p.modelId, azimuthDeg: p.azimuthDeg, elevationDeg: p.elevationDeg, distanceM: p.distanceM, rotationDeg: p.rotationDeg, color: p.color };
}

/** Eye orbits MODEL_CENTER; all supported eyes are above the normalized model. */
export function eyePosition(params: AnamorphParams): AnamorphVec3 {
  const p = validateAnamorphParams(params), az = rad(p.azimuthDeg), elevation = rad(p.elevationDeg);
  const horizontal = p.distanceM * Math.cos(elevation);
  return [horizontal * Math.sin(az), MODEL_CENTER[1] + p.distanceM * Math.sin(elevation), horizontal * Math.cos(az)];
}

/** Ray C→P continues to drawing plane y=0. Throws for a ray without a finite forward intersection. */
export function projectToPlane(point: AnamorphVec3, eye: AnamorphVec3): AnamorphVec3 {
  if (!finitePoint(point) || !finitePoint(eye) || eye[1] <= 0 || eye[1] - point[1] <= 1e-8) throw new Error('视线与平面没有有效交点');
  const t = eye[1] / (eye[1] - point[1]);
  if (t <= 0 || !Number.isFinite(t)) throw new Error('平面投影无效');
  return [eye[0] + t * (point[0] - eye[0]), 0, eye[2] + t * (point[2] - eye[2])];
}

/** Input vertices are normalized model coordinates centered at local origin. */
export function modelPointToWorld(point: AnamorphVec3, rotationDeg: number): AnamorphVec3 {
  const angle = rad(rotationDeg), x = point[0] * Math.cos(angle) + point[2] * Math.sin(angle), z = -point[0] * Math.sin(angle) + point[2] * Math.cos(angle);
  return [x, point[1] + MODEL_CENTER[1], z];
}

export function planeBounds(points: AnamorphVec3[], eye: AnamorphVec3, paddingFraction = .035): PlaneBounds {
  if (!points.length || !Number.isFinite(paddingFraction) || paddingFraction < 0 || paddingFraction > 1) throw new Error('模型顶点或投影边界无效');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const point of points) {
    const p = projectToPlane(point, eye);
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
  }
  const padX = Math.max(maxX - minX, .01) * paddingFraction + .002, padZ = Math.max(maxZ - minZ, .01) * paddingFraction + .002;
  minX -= padX; maxX += padX; minZ -= padZ; maxZ += padZ;
  return { minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ, center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2] };
}

/** Square image FOV encloses the bounding sphere with margin, independent of drawing-plane mapping. */
export function fittedFov(distanceM: number, radius = Math.sqrt(3), padding = 1.12): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(radius) || radius <= 0 || distanceM <= radius) throw new Error('取景距离无效');
  return Math.min(100, 2 * Math.asin(radius / distanceM) * 180 / Math.PI * padding);
}

/** Long edge is exact, ratio follows physical x/z extent; alpha padding remains in bounds. */
export function exportDimensions(bounds: Pick<PlaneBounds, 'width' | 'height'>, longEdge = 2048): { width: number; height: number } {
  if (!Number.isInteger(longEdge) || longEdge < 256 || longEdge > 4096 || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) throw new Error('导出尺寸无效');
  return bounds.width >= bounds.height ? { width: longEdge, height: Math.max(1, Math.round(longEdge * bounds.height / bounds.width)) } : { width: Math.max(1, Math.round(longEdge * bounds.width / bounds.height)), height: longEdge };
}

export function viewDirection(params: AnamorphParams): AnamorphVec3 { return new Vector3(...MODEL_CENTER).sub(new Vector3(...eyePosition(params))).normalize().toArray() as AnamorphVec3; }
