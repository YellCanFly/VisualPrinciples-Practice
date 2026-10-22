import { Component, Suspense, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useViewerStore } from '../../store/viewerStore'
import EyeModel from './EyeModel'
import LightRaySystem from './LightRaySystem'
import AnnotationLayer from './AnnotationLayer'
import CameraController from './CameraController'
import ProjectedLabels, { LabelProjector } from './ProjectedLabels'
import type { LabelRegistry } from './ProjectedLabels'
import PhotoreceptorSystem from './PhotoreceptorSystem'

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('三维眼球视图渲染失败', error, info.componentStack) }
  render() {
    if (this.state.failed) return <div className="viewer-error" role="alert"><strong>三维视图暂时无法显示</strong><p>请尝试刷新页面，或检查浏览器的图形加速设置。</p><button type="button" onClick={() => window.location.reload()}>重新加载</button></div>
    return this.props.children
  }
}

function ContextMonitor({ onLost }: { onLost: (lost: boolean) => void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onLost(true) }
    const restored = () => onLost(false)
    gl.domElement.addEventListener('webglcontextlost', lost)
    gl.domElement.addEventListener('webglcontextrestored', restored)
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', lost)
      gl.domElement.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl, onLost])
  return null
}

function SceneLighting() {
  const mode = useViewerStore((state) => state.ambientMode)
  const exploration = useViewerStore((state) => state.explorationMode)
  return <>
    <ambientLight intensity={exploration === 'photoreceptors' ? 1.05 : mode === 'bright' ? 1.25 : 0.75} />
    <hemisphereLight args={['#ffffff', '#a6c1c6', 1.3]} />
    <directionalLight position={[-3, 5, 7]} intensity={2.6} color="#fff7eb" />
    <directionalLight position={[4, 1, -4]} intensity={1.4} color="#d4e9f0" />
  </>
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return null
}

export default function EyeViewer() {
  const [contextLost, setContextLost] = useState(false)
  const [ready, setReady] = useState(false)
  const labels = useRef<LabelRegistry>(new Map())
  const hovered = useViewerStore((state) => state.hoveredStructure)
  const photoreceptors = useViewerStore((state) => state.explorationMode === 'photoreceptors')
  const photoView = useViewerStore((state) => state.photoreceptorView)
  const isolateRetina = useViewerStore((state) => state.isolateRetina)
  return <ViewerErrorBoundary>
    <div className="viewer-canvas" style={{ width: '100%', height: '100%', cursor: hovered ? 'pointer' : 'grab' }}>
      <Canvas orthographic camera={{ position: [0, 0.25, 9], zoom: 90, near: 0.1, far: 60 }} dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        fallback={<div className="viewer-error" role="alert"><strong>浏览器暂不支持三维显示</strong><p>请使用支持 WebGL 的浏览器，并启用图形加速。</p></div>}
        onPointerMissed={() => {
          const state = useViewerStore.getState()
          if (state.explorationMode === 'vision') state.selectStructure(null)
        }}>
        <ContextMonitor onLost={setContextLost} />
        <SceneLighting />
        <Suspense fallback={null}>
          {(!photoreceptors || photoView === 'distribution') && <EyeModel retinaOnly={photoreceptors && isolateRetina} forceCutaway={photoreceptors} />}
          {photoreceptors ? <PhotoreceptorSystem /> : <><LightRaySystem /><AnnotationLayer /></>}
          <CameraController />
          <LabelProjector registry={labels} />
          <SceneReady onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
      <ProjectedLabels registry={labels} />
      {!ready && <div className="viewer-loading">正在准备眼球模型…</div>}
      {contextLost && <div className="viewer-error" role="alert"><strong>三维图形连接已中断</strong><p>图形恢复后将继续显示，也可以刷新页面重新加载。</p></div>}
    </div>
  </ViewerErrorBoundary>
}
