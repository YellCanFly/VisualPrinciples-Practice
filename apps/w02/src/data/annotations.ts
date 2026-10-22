import type { Annotation } from '../types'

// 眼球前端在 X 负方向，Y 向上；标签和连线均在世界空间中随模型投影。
export const annotations: Annotation[] = [
  {
    id: 'annotation-cornea',
    structureId: 'cornea',
    position: [-1.7, 0.53, 0],
    labelPosition: [-2.22, 1.84, 0.08],
    fullVisible: true,
  },
  {
    id: 'annotation-iris',
    structureId: 'iris',
    position: [-1.3, -0.63, 0],
    labelPosition: [-1.85, -1.92, 0.08],
    fullVisible: true,
  },
  {
    id: 'annotation-lens',
    structureId: 'lens',
    position: [-1.03, 0.62, 0],
    labelPosition: [-0.57, 2.15, 0.08],
  },
  {
    id: 'annotation-retina',
    structureId: 'retina',
    position: [1.2, 1, 0],
    labelPosition: [1.2, 1.98, 0.08],
  },
  {
    id: 'annotation-optic-nerve',
    structureId: 'optic-nerve',
    position: [2.1, 0.36, -0.06],
    labelPosition: [2.6, -1.51, 0.08],
    fullVisible: true,
  },
]
