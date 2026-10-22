import { Focus, Moon, Sun, Sunset, Telescope } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { photoreceptorLightModes } from '../../data/photoreceptors'
import type { PhotoreceptorLight } from '../../types'

const teachingLights: PhotoreceptorLight[] = ['bright', 'twilight', 'dark']

export default function ContextControls() {
  const focusMode = useViewerStore((state) => state.focusMode)
  const ambientMode = useViewerStore((state) => state.ambientMode)
  const setFocusMode = useViewerStore((state) => state.setFocusMode)
  const setAmbientMode = useViewerStore((state) => state.setAmbientMode)
  const explorationMode = useViewerStore((state) => state.explorationMode)
  const photoreceptorLight = useViewerStore((state) => state.photoreceptorLight)
  const setPhotoreceptorLight = useViewerStore((state) => state.setPhotoreceptorLight)

  if (explorationMode === 'photoreceptors') return (
    <div className="context-controls photoreceptor-context">
      <div className="context-setting"><span className="context-icon ambient-icon"><Sun size={19} /></span><div className="context-text"><strong>教学光照</strong><small>观察两种细胞的相对视觉贡献</small></div><div className="segmented compact-segmented photo-light-segmented" role="group" aria-label="感光细胞教学光照">{teachingLights.map((light) => <button key={light} className={photoreceptorLight === light ? 'selected' : ''} aria-pressed={photoreceptorLight === light} onClick={() => setPhotoreceptorLight(light)}>{light === 'bright' ? <Sun size={13} /> : light === 'twilight' ? <Sunset size={13} /> : <Moon size={13} />}{photoreceptorLightModes[light].nameZh}</button>)}</div></div>
    </div>
  )

  return (
    <div className="context-controls">
      <div className="context-setting"><span className="context-icon"><Focus size={19} /></span><div className="context-text"><strong>观察距离</strong><small>{focusMode === 'far' ? '晶状体较扁' : '晶状体更凸'}</small></div><div className="segmented compact-segmented" role="group" aria-label="观察距离"><button className={focusMode === 'far' ? 'selected' : ''} aria-pressed={focusMode === 'far'} onClick={() => setFocusMode('far')}><Telescope size={13} />远处</button><button className={focusMode === 'near' ? 'selected' : ''} aria-pressed={focusMode === 'near'} onClick={() => setFocusMode('near')}>近处</button></div></div>
      <span className="context-divider" />
      <div className="context-setting"><span className="context-icon ambient-icon"><Sun size={19} /></span><div className="context-text"><strong>环境光线</strong><small>{ambientMode === 'bright' ? '瞳孔收缩' : '瞳孔扩大'}</small></div><div className="segmented compact-segmented" role="group" aria-label="环境明暗"><button className={ambientMode === 'bright' ? 'selected' : ''} aria-pressed={ambientMode === 'bright'} onClick={() => setAmbientMode('bright')}><Sun size={13} />明亮</button><button className={ambientMode === 'dim' ? 'selected' : ''} aria-pressed={ambientMode === 'dim'} onClick={() => setAmbientMode('dim')}><Moon size={13} />较暗</button></div></div>
    </div>
  )
}
