import type { Vector3Tuple } from '../types'

// X负为眼球前端，Y向上，Z正为本示意眼鼻侧；距离与角度不作为解剖测量。
export const MACULA_POSITION: Vector3Tuple = [1.47, 0.08, -0.5]
export const OPTIC_DISC_DIRECTION: Vector3Tuple = [1.50, 0.25, -0.10]
export const NERVE_POINTS: Vector3Tuple[] = [
  [1.54, 0.255, -0.103], [1.83, 0.30, -0.08], [2.24, 0.36, -0.06], [2.85, 0.46, -0.035],
]
// 神经示意从成像区域经视网膜回路汇向视盘，不是光线延续。
export const NEURAL_PATH: Vector3Tuple[] = [
  [1.55, -0.21, 0.09], [1.56, 0.14, -0.10], [1.83, 0.30, -0.08], [2.85, 0.46, -0.035],
]
