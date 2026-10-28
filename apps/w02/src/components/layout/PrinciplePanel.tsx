import { useState, type KeyboardEvent } from 'react'
import { Check, ChevronRight, Layers3, Microscope, Route } from 'lucide-react'
import { visionPrinciples } from '../../data/visionPrinciples'
import { eyeStructures } from '../../data/eyeStructures'
import { useViewerStore } from '../../store/viewerStore'
import PhotoreceptorNavigation from '../photoreceptors/PhotoreceptorNavigation'

export default function PrinciplePanel() {
  const [tab, setTab] = useState<'principles' | 'structures'>('principles')
  const currentStep = useViewerStore((state) => state.currentVisionStep)
  const selected = useViewerStore((state) => state.selectedStructure)
  const setStep = useViewerStore((state) => state.setStep)
  const selectStructure = useViewerStore((state) => state.selectStructure)
  const setHover = useViewerStore((state) => state.setHover)
  const explorationMode = useViewerStore((state) => state.explorationMode)
  const enterPhotoreceptors = useViewerStore((state) => state.enterPhotoreceptors)
  const exitPhotoreceptors = useViewerStore((state) => state.exitPhotoreceptors)
  const activeTab = explorationMode === 'photoreceptors' ? 'photoreceptors' : tab

  function selectTab(next: 'principles' | 'structures' | 'photoreceptors') {
    if (next === 'photoreceptors') {
      enterPhotoreceptors()
    } else {
      if (explorationMode === 'photoreceptors') exitPhotoreceptors()
      setTab(next)
    }
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const tabs = ['principles', 'structures', 'photoreceptors'] as const
    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    selectTab(tabs[nextIndex])
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(['#principle-tab', '#structure-tab', '#photoreceptor-tab'][nextIndex])?.focus()
  }

  return (
    <aside className="navigation-panel panel" aria-label="内容导航">
      <div className="panel-tabs exploration-tabs" role="tablist" aria-label="内容分类">
        <button id="principle-tab" role="tab" tabIndex={activeTab === 'principles' ? 0 : -1} onKeyDown={handleTabKey} aria-selected={activeTab === 'principles'} aria-controls="principle-list" onClick={() => selectTab('principles')} className={activeTab === 'principles' ? 'active' : ''}><Route size={14} />视觉原理</button>
        <button id="structure-tab" role="tab" tabIndex={activeTab === 'structures' ? 0 : -1} onKeyDown={handleTabKey} aria-selected={activeTab === 'structures'} aria-controls="structure-list" onClick={() => selectTab('structures')} className={activeTab === 'structures' ? 'active' : ''}><Layers3 size={14} />眼球结构</button>
        <button id="photoreceptor-tab" role="tab" tabIndex={activeTab === 'photoreceptors' ? 0 : -1} onKeyDown={handleTabKey} aria-selected={activeTab === 'photoreceptors'} aria-controls="photoreceptor-list" onClick={() => selectTab('photoreceptors')} className={activeTab === 'photoreceptors' ? 'active' : ''}><Microscope size={14} />感光细胞</button>
      </div>

      {activeTab === 'photoreceptors' ? <PhotoreceptorNavigation /> : activeTab === 'principles' ? (
        <div id="principle-list" role="tabpanel" aria-labelledby="principle-tab" className="navigation-content">
          <div className="navigation-section-label">视觉形成<span>6 个步骤</span></div>
          <div className="principle-list">
            {visionPrinciples.map((step, index) => (
              <button key={step.id} onClick={() => setStep(index)} className={`principle-item ${currentStep === index ? 'active' : ''}`} aria-current={currentStep === index ? 'step' : undefined}>
                <span className="step-number">{index < currentStep ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span>
                <span className="principle-item-text"><strong>{step.title}</strong><small>{step.subtitle}</small></span>
                <ChevronRight size={14} className="item-chevron" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div id="structure-list" role="tabpanel" aria-labelledby="structure-tab" className="navigation-content">
          <div className="navigation-section-label">眼球结构<span>{eyeStructures.length} 个结构</span></div>
          <div className="structure-list">
            {eyeStructures.map((structure) => (
              <button key={structure.id} onClick={() => selectStructure(structure.id)} onMouseEnter={() => setHover(structure.id)} onMouseLeave={() => setHover(null)} className={`structure-item ${selected === structure.id ? 'active' : ''}`} aria-pressed={selected === structure.id}>
                <span className="structure-swatch" style={{ backgroundColor: structure.color }} /><span>{structure.nameZh}</span><ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
