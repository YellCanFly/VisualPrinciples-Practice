import { Line } from '@react-three/drei'
import { annotations } from '../../data/annotations'
import { structureById } from '../../data/eyeStructures'
import { useViewerStore } from '../../store/viewerStore'

export default function AnnotationLayer() {
  const show = useViewerStore((state) => state.showAnnotations)
  const mode = useViewerStore((state) => state.viewMode)
  const selected = useViewerStore((state) => state.selectedStructure)
  if (!show) return null
  return <group>{annotations.filter((annotation) => mode === 'cutaway' || annotation.fullVisible).map((annotation) => {
    const structure = structureById[annotation.structureId]
    if (!structure) return null
    const active = selected === annotation.structureId
    return <group key={annotation.id}>
      <Line points={[annotation.position, annotation.labelPosition]} color={active ? '#c59b45' : '#809fa3'} lineWidth={active ? 1.5 : 0.8} transparent opacity={0.75} raycast={() => undefined} />
      <mesh position={annotation.position} raycast={() => undefined}>
        <sphereGeometry args={[0.032, 12, 8]} />
        <meshBasicMaterial color={active ? '#c59b45' : '#64898c'} depthTest={false} />
      </mesh>
    </group>
  })}</group>
}
