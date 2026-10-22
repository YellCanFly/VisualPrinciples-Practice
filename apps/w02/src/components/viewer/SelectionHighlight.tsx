import type { ThreeEvent } from '@react-three/fiber'
import { structureById } from '../../data/eyeStructures'
import { visionPrinciples } from '../../data/visionPrinciples'
import { useViewerStore } from '../../store/viewerStore'
import type { StructureId } from '../../types'

/** A single picking/highlight adapter for both generated meshes and future GLBs. */
export function useStructureInteraction(id: StructureId) {
  const interactive = useViewerStore((state) => state.explorationMode === 'vision')
  const selected = useViewerStore((state) => state.explorationMode === 'vision' && state.selectedStructure === id)
  const hovered = useViewerStore((state) => state.explorationMode === 'vision' && state.hoveredStructure === id)
  const step = useViewerStore((state) => state.currentVisionStep)
  const hasSelection = useViewerStore((state) => state.selectedStructure !== null)
  const related = interactive && !hasSelection && (visionPrinciples[step]?.relatedStructures.includes(id) ?? false)
  return {
    name: structureById[id].modelObjectName,
    emissive: selected ? '#c3a753' : hovered ? '#67b6bd' : related ? '#7eb1b5' : '#000000',
    emissiveIntensity: selected ? 0.28 : hovered ? 0.16 : related ? 0.055 : 0,
    selected,
    handlers: {
      onClick: (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        if (interactive) useViewerStore.getState().selectStructure(id)
      },
      onPointerOver: (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        if (interactive) useViewerStore.getState().setHover(id)
      },
      onPointerOut: () => { if (interactive) useViewerStore.getState().setHover(null) },
    },
  }
}
