import { ArrowLeft, ChevronRight, MapPin, Microscope } from 'lucide-react'
import { photoreceptorCells, photoreceptorRegions } from '../../data/photoreceptors'
import { useViewerStore } from '../../store/viewerStore'
import type { PhotoreceptorRegion, PhotoreceptorSelection } from '../../types'

const regions: PhotoreceptorRegion[] = ['fovea', 'peripheral', 'optic-disc']
const selections: PhotoreceptorSelection[] = ['both', 'cone', 'rod']

export default function PhotoreceptorNavigation() {
  const region = useViewerStore((state) => state.photoreceptorRegion)
  const selection = useViewerStore((state) => state.selectedPhotoreceptor)
  const view = useViewerStore((state) => state.photoreceptorView)
  const setRegion = useViewerStore((state) => state.setPhotoreceptorRegion)
  const select = useViewerStore((state) => state.selectPhotoreceptor)
  const setView = useViewerStore((state) => state.setPhotoreceptorView)
  const exit = useViewerStore((state) => state.exitPhotoreceptors)

  return (
    <div id="photoreceptor-list" role="tabpanel" aria-labelledby="photoreceptor-tab" className="navigation-content photoreceptor-navigation">
      <div className="navigation-section-label">认识感光细胞<span>2 种细胞</span></div>
      <p className="photoreceptor-navigation-intro">感光细胞位于视网膜。先找到位置，再放大观察它们的形态。</p>

      <div className="photo-navigation-group">
        <h3><MapPin size={13} />选择视网膜区域</h3>
        <div className="photo-region-list">
          {regions.map((id) => <button key={id} className={`photo-region-button ${region === id ? 'active' : ''}`} aria-pressed={region === id} onClick={() => setRegion(id)}><span className="region-marker" /><span>{photoreceptorRegions[id].nameZh}</span><ChevronRight size={13} /></button>)}
        </div>
      </div>

      <div className="photo-navigation-group">
        <h3>选择要观察的细胞</h3>
        <div className="photo-cell-list" role="group" aria-label="感光细胞选择">
          {selections.map((id) => <button key={id} className={`photo-cell-button ${selection === id ? 'active' : ''}`} aria-pressed={selection === id} onClick={() => select(id)}>{id === 'both' ? <span className="double-cell-dot"><i style={{ background: photoreceptorCells.cone.color }} /><i style={{ background: photoreceptorCells.rod.color }} /></span> : <span className="structure-swatch" style={{ background: photoreceptorCells[id].color }} />}<span>{id === 'both' ? '两种一起比较' : photoreceptorCells[id].nameZh}</span></button>)}
        </div>
      </div>

      <button className="photo-zoom-button" onClick={() => setView(view === 'detail' ? 'distribution' : 'detail')}><Microscope size={15} />{view === 'detail' ? '回到整体分布' : '放大当前区域'}<ChevronRight size={13} /></button>
      <p className="photo-navigation-note">{view !== 'detail' ? '整体视图中的点展示分布趋势，实际数量请看右侧比例条。' : region === 'optic-disc' ? '当前放大：视盘。这里是神经纤维出口，没有感光细胞。' : region === 'fovea' && selection === 'rod' ? '中央凹中心无视杆，可切换视锥或周边区域。' : `当前放大：${photoreceptorRegions[region].nameZh}。可旋转模型，比较外节形态。`}</p>
      <button className="photo-return-button text-button" onClick={exit}><ArrowLeft size={13} />返回视觉之旅</button>
    </div>
  )
}
