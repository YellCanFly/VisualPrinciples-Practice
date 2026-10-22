import { useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { annotations } from '../../data/annotations'
import { structureById } from '../../data/eyeStructures'
import { useViewerStore } from '../../store/viewerStore'
import type { Vector3Tuple } from '../../types'
import type { PhotoreceptorRegion } from '../../types'
import { photoreceptorCells, photoreceptorRegions } from '../../data/photoreceptors'
import { getPhotoreceptorDetailLabels } from '../../data/photoreceptorAnnotations'

export type LabelRegistry = Map<string, { element: HTMLDivElement; position: THREE.Vector3 }>

/** Projects world anchors to ordinary DOM nodes owned by the app's existing root. */
export function LabelProjector({ registry }: { registry: RefObject<LabelRegistry> }) {
  const projected = useRef(new THREE.Vector3())
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    for (const { element, position } of registry.current.values()) {
      projected.current.copy(position).project(camera)
      const { x, y, z } = projected.current
      const visible = z > -1 && z < 1 && Math.abs(x) < 1.25 && Math.abs(y) < 1.25
      element.style.visibility = visible ? 'visible' : 'hidden'
      if (visible) element.style.transform = `translate3d(${(x + 1) * size.width / 2}px,${(1 - y) * size.height / 2}px,0)`
    }
  })
  return null
}

export default function ProjectedLabels({ registry }: { registry: RefObject<LabelRegistry> }) {
  const show = useViewerStore((state) => state.showAnnotations)
  const mode = useViewerStore((state) => state.viewMode)
  const selected = useViewerStore((state) => state.selectedStructure)
  const rays = useViewerStore((state) => state.showLightRays)
  const focus = useViewerStore((state) => state.focusMode)
  const step = useViewerStore((state) => state.currentVisionStep)
  const exploration = useViewerStore((state) => state.explorationMode)
  const photoView = useViewerStore((state) => state.photoreceptorView)
  const photoRegion = useViewerStore((state) => state.photoreceptorRegion)
  const photoSelection = useViewerStore((state) => state.selectedPhotoreceptor)
  const photoreceptors = exploration === 'photoreceptors'

  function anchor(id: string, position: Vector3Tuple) {
    return (element: HTMLDivElement | null) => {
      if (element) registry.current.set(id, { element, position: new THREE.Vector3(...position) })
      else registry.current.delete(id)
    }
  }
  const outerStyle = { position: 'absolute' as const, top: 0, left: 0, visibility: 'hidden' as const }
  const centeredStyle = { transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap' as const }
  return <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden' }}>
    {show && !photoreceptors && annotations.filter((annotation) => mode === 'cutaway' || annotation.fullVisible).map((annotation) => {
      const structure = structureById[annotation.structureId]
      if (!structure) return null
      return <div key={annotation.id} ref={anchor(annotation.id, annotation.labelPosition)} style={outerStyle}>
        <div style={centeredStyle}>
          <button type="button" className={`annotation-label${selected === annotation.structureId ? ' active' : ''}`}
            style={{ pointerEvents: 'auto' }} onClick={() => useViewerStore.getState().selectStructure(annotation.structureId)}
            onPointerEnter={() => useViewerStore.getState().setHover(annotation.structureId)} onPointerLeave={() => useViewerStore.getState().setHover(null)}>
            {structure.nameZh}
          </button>
        </div>
      </div>
    })}
    {show && photoreceptors && photoView === 'distribution' && (Object.keys(photoreceptorRegions) as PhotoreceptorRegion[]).map((id) => {
      const region = photoreceptorRegions[id]
      return <div key={`photo-${id}`} ref={anchor(`photo-${id}`, region.labelPosition)} style={outerStyle}>
        <div style={centeredStyle}>
          <button type="button" className={`annotation-label${photoRegion === id ? ' active' : ''}`} style={{ pointerEvents: 'auto' }} aria-pressed={photoRegion === id} title="选择位置，双击放大局部"
            onClick={() => useViewerStore.getState().setPhotoreceptorRegion(id)}
            onDoubleClick={() => { useViewerStore.getState().setPhotoreceptorRegion(id); useViewerStore.getState().setPhotoreceptorView('detail') }}>
            {region.nameZh}
          </button>
        </div>
      </div>
    })}
    {show && photoreceptors && photoView === 'detail' && getPhotoreceptorDetailLabels(photoRegion, photoSelection).map((label) => <div key={label.id} ref={anchor(label.id, label.position)} style={outerStyle}>
      <div style={centeredStyle}>
        {label.kind ? <button type="button" className={`annotation-label${photoSelection === label.kind ? ' active' : ''}`} style={{ pointerEvents: 'auto', borderColor: photoreceptorCells[label.kind].color }} aria-pressed={photoSelection === label.kind}
          onClick={() => useViewerStore.getState().selectPhotoreceptor(label.kind!)}>{label.text}</button>
          : <span className="scene-caption">{label.text}</span>}
      </div>
    </div>)}
    {rays && !photoreceptors && <div ref={anchor('object-caption', [focus === 'near' ? -2.9 : -3.65, -1, 0.1])} style={outerStyle}>
      <div style={centeredStyle}><span className="scene-caption">外界物体</span></div>
    </div>}
    {rays && !photoreceptors && mode === 'cutaway' && step >= 4 && <div ref={anchor('image-caption', [1.55, -0.81, 0.1])} style={outerStyle}>
      <div style={centeredStyle}><span className="scene-caption">倒立 · 缩小</span></div>
    </div>}
  </div>
}
