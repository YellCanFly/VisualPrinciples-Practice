import { photoreceptorRegions } from '../data/photoreceptors'
import type { PhotoreceptorLight, PhotoreceptorRegion, Vector3Tuple } from '../types'

export const PHOTORECEPTOR_RADIUS = 1.525
export type PhotoreceptorKind = 'cone' | 'rod'
export interface PhotoreceptorSample { kind: PhotoreceptorKind; position: Vector3Tuple }

// 可视化用角域适当放大，无视杆区及视盘并非按真实解剖比例测量。
export const FOVEA_ROD_FREE_ANGLE = 0.045
export const OPTIC_DISC_EMPTY_ANGLE = 0.10
const direction = (region: PhotoreceptorRegion) => photoreceptorRegions[region].position.map((v) => v / PHOTORECEPTOR_RADIUS) as Vector3Tuple
const FOVEA = direction('fovea')
const DISC = direction('optic-disc')
const clamp = (v: number) => Math.min(1, Math.max(-1, v))
const dot = (a: Vector3Tuple, b: Vector3Tuple) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function retinalAngle(position: Vector3Tuple, region: PhotoreceptorRegion) {
  const length = Math.hypot(...position)
  return Math.acos(clamp(dot(position.map((v) => v / length) as Vector3Tuple, direction(region))))
}

export function getRegionCellKinds(region: PhotoreceptorRegion): PhotoreceptorKind[] {
  return region === 'optic-disc' ? [] : region === 'fovea' ? ['cone'] : ['cone', 'rod']
}

/** 定性贡献映射，不是光强、膜电位、暗适应时间或阈值模型。 */
export function getPhotoreceptorResponse(light: PhotoreceptorLight) {
  return {
    bright: { cone: 1, rod: 0.12 },
    twilight: { cone: 0.6, rod: 0.72 },
    dark: { cone: 0.1, rod: 1 },
  }[light]
}

/** 确定性等面积候选点 + 定性密度权重，避开无感光区。仅展示分布趋势。 */
export function buildPhotoreceptorDistribution(): PhotoreceptorSample[] {
  const samples: PhotoreceptorSample[] = []
  let seed = 20261007
  const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296 }
  const anteriorLimit = Math.cos(0.86)
  for (let i = 0; i < 12500; i += 1) {
    const x = -(anteriorLimit - (anteriorLimit + 1) * random())
    const phi = Math.PI + Math.PI * random()
    const radius = Math.sqrt(1 - x * x)
    const unit: Vector3Tuple = [x, radius * Math.cos(phi), radius * Math.sin(phi)]
    const discAngle = Math.acos(clamp(dot(unit, DISC)))
    if (discAngle < OPTIC_DISC_EMPTY_ANGLE) continue
    const fovealAngle = Math.acos(clamp(dot(unit, FOVEA)))
    const kind: PhotoreceptorKind = random() < 0.34 ? 'cone' : 'rod'
    if (kind === 'rod' && fovealAngle < FOVEA_ROD_FREE_ANGLE) continue
    const weight = kind === 'cone'
      ? 0.045 + 0.9 * Math.exp(-fovealAngle / 0.19)
      : 0.065 + 0.35 * Math.exp(-Math.pow((fovealAngle - Math.PI / 10) / 0.6, 2))
    if (random() < weight) samples.push({ kind, position: unit.map((v) => v * PHOTORECEPTOR_RADIUS) as Vector3Tuple })
  }
  // 中心高密度视锥群：相同球面坐标，确定性密集抽样。
  const base: Vector3Tuple = [0, 1, 0]
  const tangent: Vector3Tuple = [FOVEA[1] * base[2] - FOVEA[2] * base[1], FOVEA[2] * base[0] - FOVEA[0] * base[2], FOVEA[0] * base[1] - FOVEA[1] * base[0]]
  const length = Math.hypot(...tangent)
  const u = tangent.map((v) => v / length) as Vector3Tuple
  const v: Vector3Tuple = [FOVEA[1] * u[2] - FOVEA[2] * u[1], FOVEA[2] * u[0] - FOVEA[0] * u[2], FOVEA[0] * u[1] - FOVEA[1] * u[0]]
  for (let i = 0; i < 110; i += 1) {
    const angle = Math.sqrt((i + 0.5) / 110) * 0.085
    const phi = i * 2.399963229728653
    const unit = FOVEA.map((axis, j) => axis * Math.cos(angle) + (u[j] * Math.cos(phi) + v[j] * Math.sin(phi)) * Math.sin(angle)) as Vector3Tuple
    if (unit[2] > 0 || Math.acos(clamp(dot(unit, DISC))) < OPTIC_DISC_EMPTY_ANGLE) continue
    samples.push({ kind: 'cone', position: unit.map((axis) => axis * PHOTORECEPTOR_RADIUS) as Vector3Tuple })
  }
  return samples
}
