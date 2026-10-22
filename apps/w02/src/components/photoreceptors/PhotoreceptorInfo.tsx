import { ArrowUpRight, BookOpen, MapPin } from 'lucide-react'
import { PHOTORECEPTOR_MODEL_NOTE, photoreceptorCells, photoreceptorRegions, photoreceptorSources } from '../../data/photoreceptors'
import { useViewerStore } from '../../store/viewerStore'
import PerceptionDemo from './PerceptionDemo'

function CellSilhouette({ type }: { type: 'cone' | 'rod' }) {
  const color = photoreceptorCells[type].color
  return <svg className="cell-silhouette" viewBox="0 0 36 72" role="img" aria-label={type === 'cone' ? '视锥外节典型渐细形态示意' : '视杆外节典型长圆柱形态示意'}><path d={type === 'cone' ? 'M15 3L11 30Q18 34 25 30L21 3Z' : 'M13 3Q18 0 23 3V31H13Z'} fill={color} /><path d="M13 33Q18 30 23 33L23 41Q18 46 13 41Z" fill={color} opacity=".55" /><path d="M18 43V47M18 59V65M12 68Q18 62 24 68" fill="none" stroke={color} strokeWidth="2" /><ellipse cx="18" cy="53" rx="6" ry="7" fill={color} opacity=".7" /><circle cx="18" cy="53" r="2.5" fill="#fff" opacity=".75" /></svg>
}

export default function PhotoreceptorInfo() {
  const selection = useViewerStore((state) => state.selectedPhotoreceptor)
  const region = useViewerStore((state) => state.photoreceptorRegion)
  const view = useViewerStore((state) => state.photoreceptorView)
  const light = useViewerStore((state) => state.photoreceptorLight)
  const setRegion = useViewerStore((state) => state.setPhotoreceptorRegion)
  const cone = photoreceptorCells.cone
  const rod = photoreceptorCells.rod
  const coneShare = cone.count / (cone.count + rod.count) * 100
  const quantityRatio = Math.round(rod.count / cone.count)
  const currentRegion = photoreceptorRegions[region]
  const columns = ['cone', 'rod'] as const
  const rows = [
    { label: '外节形态', key: 'shape' },
    { label: '感光特点', key: 'sensitivity' },
    { label: '视觉分工', key: 'visionRole' },
  ] as const

  return (
    <aside className="info-panel panel photoreceptor-info-panel" aria-label="感光细胞功能与差异说明">
      <div className="info-panel-label"><BookOpen size={16} /> 细胞与视觉<span className="tiny-dot" /></div>
      <div className="info-content photoreceptor-info">
        <div className="info-index">{view === 'detail' ? '局部放大' : '整体定位'}<span>视网膜光感受器</span></div>
        <h2>{selection === 'both' ? '视锥与视杆' : photoreceptorCells[selection].nameZh}</h2>
        <div className="photo-region-note"><h3><MapPin size={13} />{currentRegion.nameZh}</h3><p>{currentRegion.description}</p></div>
        {(region === 'optic-disc' || (region === 'fovea' && selection === 'rod')) && <div className="photo-empty-hint"><strong>{region === 'optic-disc' ? '这里没有两类感光细胞' : '中央凹中心没有视杆细胞'}</strong><p>{region === 'optic-disc' ? '视盘形成生理盲点，可换一个区域观察细胞。' : '这是正常的分布特征。切换周边视网膜，就能看到视杆。'}</p><button onClick={() => setRegion('peripheral')}>在周边视网膜观察<ArrowUpRight size={12} /></button></div>}

        <table className="photo-comparison-table">
          <caption className="sr-only">视锥细胞与视杆细胞的形状、感光与视觉功能比较</caption>
          <thead><tr>{columns.map((id) => <th key={id} scope="col" className={selection === 'both' || selection === id ? 'selected-cell-column' : ''}><CellSilhouette type={id} /><span style={{ color: photoreceptorCells[id].color }}>{photoreceptorCells[id].nameZh}</span></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key}>{columns.map((id) => <td key={id} className={selection === 'both' || selection === id ? 'selected-cell-column' : ''}><strong>{row.label}</strong><p>{photoreceptorCells[id][row.key]}</p></td>)}</tr>)}</tbody>
        </table>
        <p className="photo-small-note photo-shape-note">形状示意采用典型周边形态；中央凹视锥更细长。</p>

        <div className="photo-quantity-card">
          <div className="photo-section-heading">单眼数量估计<span>约 1 : {quantityRatio}</span></div>
          <div className="photo-quantity-bar" role="img" aria-label={`单眼视锥${cone.countLabel}，视杆${rod.countLabel}，数量约一比${quantityRatio}`}><span style={{ width: `${coneShare}%`, background: cone.color }} /><span style={{ width: `${100 - coneShare}%`, background: rod.color }} /></div>
          <div className="photo-quantity-labels"><span><i style={{ background: cone.color }} />视锥<strong>{cone.countLabel}</strong></span><span><i style={{ background: rod.color }} />视杆<strong>{rod.countLabel}</strong></span></div>
          <p className="photo-small-note">1990 年人类感光细胞数量研究的单眼样本均值，存在个体与测量方法差异；模型中的点数不代表真实计数。</p>
        </div>

        <PerceptionDemo light={light} />
        <div className="photo-direction-note"><strong>光线与信号的方向</strong><p>光线从玻璃体侧进入，外节朝向色素上皮。感光信号经双极细胞等回路处理，再由神经节细胞轴突汇入视神经（回路简化）。</p></div>
        <details className="photo-sources"><summary><BookOpen size={13} />科学资料与模型说明</summary><p className="photo-small-note">{PHOTORECEPTOR_MODEL_NOTE}</p><ul>{photoreceptorSources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={12} /></a></li>)}</ul></details>
      </div>
    </aside>
  )
}
