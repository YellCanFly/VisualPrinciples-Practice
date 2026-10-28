import { useState } from 'react'
import { MousePointer2 } from 'lucide-react'
import EyeViewer from './components/viewer/EyeViewer'
import Header from './components/layout/Header'
import PrinciplePanel from './components/layout/PrinciplePanel'
import InfoPanel from './components/layout/InfoPanel'
import ViewControls from './components/controls/ViewControls'
import ContextControls from './components/controls/ContextControls'
import AnimationControls from './components/controls/AnimationControls'
import HelpDialog from './components/ui/HelpDialog'
import { useViewerStore } from './store/viewerStore'
import { visionPrinciples } from './data/visionPrinciples'
import { photoreceptorRegions } from './data/photoreceptors'
import './styles.css'

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false)
  const currentStep = useViewerStore((state) => state.currentVisionStep)
  const viewMode = useViewerStore((state) => state.viewMode)
  const showLightRays = useViewerStore((state) => state.showLightRays)
  const explorationMode = useViewerStore((state) => state.explorationMode)
  const photoreceptorView = useViewerStore((state) => state.photoreceptorView)
  const photoreceptorRegion = useViewerStore((state) => state.photoreceptorRegion)
  const step = visionPrinciples[currentStep]
  const isPhotoreceptors = explorationMode === 'photoreceptors'

  return (
    <div className={`app-shell ${isPhotoreceptors ? 'photoreceptor-mode' : ''}`}>
      <Header onHelp={() => setHelpOpen(true)} />
      <main className="main-content">
        <section className="page-intro" aria-labelledby="page-title">
          <h1 id="page-title">{isPhotoreceptors ? '视锥与视杆' : '视觉形成'}</h1>
        </section>

        <div className="workspace">
          <PrinciplePanel />
          <section className="viewer-panel" aria-label={isPhotoreceptors ? '感光细胞三维交互演示' : '眼球三维交互演示'}>
            <ViewControls />
            <div className="viewer-stage">
              <div className="scene-heading"><span className="scene-status" />{isPhotoreceptors ? (photoreceptorView === 'detail' ? '视网膜局部放大' : '视网膜分布示意') : (viewMode === 'cutaway' ? '半剖视图' : '完整眼球')}</div>
              <div className="scene-step-pill"><span>{isPhotoreceptors ? (photoreceptorView === 'detail' ? '放大' : '定位') : String(currentStep + 1).padStart(2, '0')}</span>{isPhotoreceptors ? photoreceptorRegions[photoreceptorRegion].nameZh : step.title}</div>
              <EyeViewer />
              <div className="scene-footer">
                <span><MousePointer2 size={13} /> 拖动旋转 · 滚轮缩放</span>
                {isPhotoreceptors ? <span className="cell-scene-legend"><i className="cone-dot" />视锥<i className="rod-dot" />视杆</span> : showLightRays && <span className="ray-legend"><i />示意光线</span>}
              </div>
            </div>
            <ContextControls />
          </section>
          <InfoPanel />
        </div>

        <AnimationControls />
        <footer className="page-footer">
          <p><span className="footer-dot" /> {isPhotoreceptors ? '教学示意 · 细胞颜色、点密度和空间比例为教学编码' : '教学示意模型 · 光线路径与结构比例经过简化'}</p>
        </footer>
      </main>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
