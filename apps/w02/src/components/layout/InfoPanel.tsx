import { ArrowLeft, ArrowUpRight, Lightbulb, ScanEye } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { structureById } from '../../data/eyeStructures'
import { visionPrinciples } from '../../data/visionPrinciples'
import PhotoreceptorInfo from '../photoreceptors/PhotoreceptorInfo'

function OpticalDiagram() {
  return (
    <svg className="optical-diagram" viewBox="0 0 256 146" role="img" aria-label="外界物体发出的光经过角膜和晶状体，在视网膜形成倒立的像">
      <defs><marker id="optical-arrow" markerWidth="5" markerHeight="5" refX="3" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#e3a44b" /></marker></defs>
      <path d="M76 74H232" stroke="#c5d4d8" strokeDasharray="3 4" />
      <path d="M124 35C169 14 222 37 226 73C228 106 174 132 126 112C111 106 102 92 102 74C102 57 110 42 124 35Z" fill="#e8f0f2" stroke="#91a9b3" strokeWidth="1.5" />
      <path d="M216 46C226 57 229 85 216 101" fill="none" stroke="#d18070" strokeWidth="3" />
      <path d="M113 48Q91 74 113 100" fill="#eef9f9" stroke="#64aaa8" strokeWidth="1.5" />
      <ellipse cx="139" cy="74" rx="7" ry="22" fill="#c9e8e4" stroke="#64aaa8" strokeWidth="1.5" />
      <path d="M112 55V66M112 82V94" stroke="#518e86" strokeWidth="3" />
      <path d="M40 48L106 67L139 69L219 91M40 48L106 79L139 81L219 91" fill="none" stroke="#e3a44b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M40 100L106 81L139 79L219 58M40 100L106 69L139 67L219 58" fill="none" stroke="#e3a44b" strokeWidth="1.6" strokeLinejoin="round" opacity=".5" />
      <path d="M40 101V47M34 54L40 47L46 54" stroke="#318e87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M219 58V91M215 87L219 91L223 87" stroke="#d18070" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="180" cy="78" r="2" fill="#e3a44b" />
      <text x="40" y="128" textAnchor="middle">物体</text><text x="109" y="24" textAnchor="middle">角膜</text><text x="143" y="128" textAnchor="middle">晶状体</text><text x="219" y="24" textAnchor="middle">视网膜</text>
    </svg>
  )
}

export default function InfoPanel() {
  const currentStep = useViewerStore((state) => state.currentVisionStep)
  const selected = useViewerStore((state) => state.selectedStructure)
  const selectStructure = useViewerStore((state) => state.selectStructure)
  const setStep = useViewerStore((state) => state.setStep)
  const focusMode = useViewerStore((state) => state.focusMode)
  const ambientMode = useViewerStore((state) => state.ambientMode)
  const explorationMode = useViewerStore((state) => state.explorationMode)
  const step = visionPrinciples[currentStep]
  const structure = selected ? structureById[selected] : undefined
  const relatedSteps = structure ? visionPrinciples.filter((item) => item.relatedStructures.includes(structure.id)) : []

  if (explorationMode === 'photoreceptors') return <PhotoreceptorInfo />

  return (
    <aside className="info-panel panel" aria-label={structure ? '当前结构说明' : '当前视觉原理说明'}>
      <div className="info-panel-label"><ScanEye size={16} /> {structure ? '结构探索' : '原理解析'}<span className="tiny-dot" /></div>
      <div className="info-content">
        {structure ? (
          <>
            <button className="back-to-step text-button" onClick={() => selectStructure(null)}><ArrowLeft size={13} /> 返回当前原理</button>
            <div className="info-index">眼球结构<span className="structure-swatch" style={{ backgroundColor: structure.color }} /></div>
            <h2>{structure.nameZh}</h2>
            <p className="info-description">{structure.description}</p>
            <div className="key-point"><div><Lightbulb size={16} /><strong>视觉过程中的作用</strong></div><p>{structure.visionRole}</p></div>
            {relatedSteps.length > 0 && <div className="related-section"><h3>相关视觉原理</h3><div className="related-step-links">{relatedSteps.map((item) => <button key={item.id} onClick={() => setStep(visionPrinciples.indexOf(item))}>{item.title}<ArrowUpRight size={13} /></button>)}</div></div>}
          </>
        ) : (
          <>
            <div className="info-index">步骤 {String(currentStep + 1).padStart(2, '0')}<span>/ 06</span></div>
            <h2>{step.title}</h2>
            <p className="info-subtitle">{step.subtitle}</p>
            <p className="info-description">{step.description}</p>
            <div className="key-point"><div><Lightbulb size={16} /><strong>关键理解</strong></div><p>{step.keyPoint}</p></div>
            <div className="related-section"><h3>参与这一过程的结构</h3><div className="structure-tags">{step.relatedStructures.map((id) => <button key={id} onClick={() => selectStructure(id)}><span style={{ backgroundColor: structureById[id].color }} />{structureById[id].nameZh}<ArrowUpRight size={11} /></button>)}</div></div>
          </>
        )}

        <div className="diagram-card"><div className="diagram-heading"><span />光线与成像示意</div><OpticalDiagram /><p>光线会聚，在视网膜形成倒立、缩小的像</p></div>
        <div className="observation-note"><span className="observation-line" /><div><strong>试着改变条件</strong><p>{currentStep === 2 ? `切换明暗环境，观察瞳孔${ambientMode === 'bright' ? '收缩' : '扩大'}。` : currentStep === 3 ? `切换观察距离，观察晶状体${focusMode === 'far' ? '变平' : '变凸'}。` : '旋转模型，或点击结构标注，换个角度理解眼球。'}</p></div></div>
      </div>
    </aside>
  )
}
