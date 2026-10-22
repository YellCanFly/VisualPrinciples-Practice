export type StructureId =
  | 'cornea'
  | 'iris'
  | 'pupil'
  | 'lens'
  | 'vitreous'
  | 'retina'
  | 'macula'
  | 'sclera'
  | 'ciliary-body'
  | 'optic-nerve'

export type ViewMode = 'full' | 'cutaway'
export type FocusMode = 'far' | 'near'
export type AmbientMode = 'bright' | 'dim'
export type ExplorationMode = 'vision' | 'photoreceptors'
export type PhotoreceptorView = 'distribution' | 'detail'
export type PhotoreceptorRegion = 'fovea' | 'peripheral' | 'optic-disc'
export type PhotoreceptorSelection = 'both' | 'cone' | 'rod'
export type PhotoreceptorLight = 'bright' | 'twilight' | 'dark'
export type CameraPreset = 'side-cutaway' | 'front'
export type Vector3Tuple = [number, number, number]

export interface EyeStructure {
  id: StructureId
  nameZh: string
  nameEn: string
  description: string
  visionRole: string
  modelObjectName: string
  category: string
  color: string
}

export interface VisionPrincipleStep {
  id: string
  title: string
  subtitle: string
  description: string
  relatedStructures: StructureId[]
  cameraPreset: CameraPreset
  animationType: string
  /** 教学动画时长，单位为秒。 */
  duration: number
  keyPoint: string
}

export interface Annotation {
  id: string
  structureId: StructureId
  position: Vector3Tuple
  labelPosition: Vector3Tuple
  /** 完整眼球模式仍可见的外部结构标注。 */
  fullVisible?: boolean
}

export type EyeAnnotation = Annotation
