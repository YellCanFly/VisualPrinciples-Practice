import { photoreceptorCells, photoreceptorRegions } from './photoreceptors'
import type { PhotoreceptorKind } from '../utils/photoreceptors'
import type { PhotoreceptorRegion, PhotoreceptorSelection, Vector3Tuple } from '../types'

export interface PhotoreceptorLabel {
  id: string
  text: string
  position: Vector3Tuple
  target?: Vector3Tuple
  kind?: PhotoreceptorKind
}

/** Only spatial part names live here; knowledge and scientific notes stay in data. */
export function getPhotoreceptorDetailLabels(region: PhotoreceptorRegion, selection: PhotoreceptorSelection): PhotoreceptorLabel[] {
  if (region === 'optic-disc') return [
    { id: 'disc-area', text: photoreceptorRegions[region].nameZh, position: [-1.5, 0.65, 0.3], target: [-0.9, 0.5, 0] },
    { id: 'disc-fibers', text: '视神经纤维出口', position: [0.6, 2.5, 0.3], target: [0.3, 1.8, 0] },
    { id: 'disc-vitreous', text: '玻璃体侧', position: [0, -1.25, 0.3] },
  ]
  const hasCells = region !== 'fovea' || selection !== 'rod'
  const referenceX = region === 'fovea' ? -1.2 : selection === 'cone' ? -0.42 : selection === 'rod' ? -0.75 : -1.36
  const labels: PhotoreceptorLabel[] = [
    { id: 'pigment-layer', text: '色素上皮', position: [1.9, 2.35, 0.7], target: [1.5, 2.27, 0.2] },
    { id: 'vitreous-side', text: '玻璃体侧', position: [0, -2.34, 0.3] },
    { id: 'light-direction', text: '光进入 ↑', position: [2.8, 0.35, 0.2] },
  ]
  if (region === 'peripheral') labels.push(
    { id: 'neural-layer', text: '视网膜神经网络（简化）', position: [1.1, -1.83, 0.5], target: [1.1, -1.55, 0] },
    { id: 'signal-direction', text: '神经信息 ↓', position: [2.5, -1.28, 0.2] },
  )
  if (!hasCells) return labels
  labels.push(
    { id: 'outer-segment', text: '外节 · 感光部位', position: [-2.5, 1.5, 0.55], target: [referenceX, 1.5, 0.13] },
    { id: 'inner-segment', text: '内节', position: [-2.5, 0.56, 0.55], target: [referenceX, 0.56, 0.13] },
    { id: 'cell-body', text: '胞体', position: [-2.5, -0.28, 0.55], target: [referenceX, -0.28, 0.13] },
    { id: 'synapse', text: '突触端', position: [-2.5, -1.04, 0.55], target: [referenceX, -1.04, 0.13] },
  )
  if (region === 'fovea') labels.push({ id: 'cone-name', text: photoreceptorCells.cone.nameZh, kind: 'cone', position: [0, 2.68, 0.2] })
  else {
    if (selection !== 'cone') labels.push({ id: 'rod-name', text: photoreceptorCells.rod.nameZh, kind: 'rod', position: [selection === 'rod' ? 0 : -0.82, 2.68, 0.2] })
    if (selection !== 'rod') labels.push({ id: 'cone-name', text: photoreceptorCells.cone.nameZh, kind: 'cone', position: [selection === 'cone' ? 0 : 1.04, 2.68, 0.2] })
  }
  return labels
}

