import { ArrowLeft, Check, ChevronLeft, ChevronRight, Microscope, Pause, Play, RotateCcw } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { visionPrinciples } from '../../data/visionPrinciples'

function AnimationProgress() {
  const progress = useViewerStore((state) => state.animationProgress)
  const percentage = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return <div className="playback-progress" role="progressbar" aria-label="当前步骤动画进度" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /><span className="sr-only">{percentage}%</span></div>
}

export default function AnimationControls() {
  const currentStep = useViewerStore((state) => state.currentVisionStep)
  const playing = useViewerStore((state) => state.isAnimationPlaying)
  const autoAdvance = useViewerStore((state) => state.autoAdvance)
  const setStep = useViewerStore((state) => state.setStep)
  const togglePlayback = useViewerStore((state) => state.togglePlayback)
  const replay = useViewerStore((state) => state.replay)
  const previousStep = useViewerStore((state) => state.previousStep)
  const nextStep = useViewerStore((state) => state.nextStep)
  const setAutoAdvance = useViewerStore((state) => state.setAutoAdvance)
  const explorationMode = useViewerStore((state) => state.explorationMode)
  const exitPhotoreceptors = useViewerStore((state) => state.exitPhotoreceptors)

  if (explorationMode === 'photoreceptors') return (
    <section className="animation-panel panel photo-exploration-panel" aria-label="感光细胞探索提示">
      <span className="photo-exploration-icon"><Microscope size={20} /></span>
      <div><h2>找到位置，再看细胞的分工</h2><p>选择区域，放大形态，切换明暗。原视觉之旅已暂停，返回后可继续。</p></div>
      <button className="photo-return-action" onClick={exitPhotoreceptors}><ArrowLeft size={14} />返回视觉之旅</button>
    </section>
  )

  return (
    <section className="animation-panel panel" aria-label="视觉原理动画控制">
      <div className="animation-heading"><div><h2>光线的视觉之旅</h2><span>循序探索，理解每一个瞬间</span></div><span className="step-count">当前步骤 <strong>{String(currentStep + 1).padStart(2, '0')}</strong><span> / 06</span></span></div>
      <div className="journey-timeline" aria-label="教学步骤">
        {visionPrinciples.map((step, index) => <button key={step.id} onClick={() => setStep(index)} className={`timeline-step ${currentStep === index ? 'active' : ''} ${currentStep > index ? 'completed' : ''}`} aria-current={currentStep === index ? 'step' : undefined}><span className="timeline-number">{index < currentStep ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><span>{step.title}</span></button>)}
      </div>
      <AnimationProgress />
      <div className="playback-controls">
        <div className="playback-primary"><button className="play-button" onClick={togglePlayback}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}{playing ? '暂停动画' : '播放动画'}</button><button className="replay-button" onClick={replay}><RotateCcw size={14} />重新播放</button></div>
        <label className="auto-advance"><input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} /><span>自动进入下一步</span></label>
        <div className="step-controls"><button disabled={currentStep === 0} onClick={previousStep}><ChevronLeft size={15} />上一步</button><button disabled={currentStep === visionPrinciples.length - 1} onClick={nextStep}>下一步<ChevronRight size={15} /></button></div>
      </div>
    </section>
  )
}
