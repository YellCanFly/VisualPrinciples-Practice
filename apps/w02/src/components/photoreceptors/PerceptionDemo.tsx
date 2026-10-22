import { photoreceptorLightModes } from '../../data/photoreceptors'
import type { PhotoreceptorLight } from '../../types'

export default function PerceptionDemo({ light }: { light: PhotoreceptorLight }) {
  const mode = photoreceptorLightModes[light]
  return (
    <div className="perception-card" data-light={light}>
      <div className="photo-section-heading">全眼感知趋势<span>{mode.nameZh}</span></div>
      <div className="perception-pattern" role="img" aria-label={`${mode.nameZh}条件下全眼颜色与细节感知的教学示意`}>
        <div className="perception-colors"><i /><i /><i /></div>
        <svg className="perception-details" viewBox="0 0 98 36" aria-hidden="true"><path d="M3 3H95M3 8H95M3 13H95M3 18H95M3 23H95M3 28H95M3 33H95" stroke="currentColor" strokeWidth="1.5" /><path d="M20 0V36M49 0V36M78 0V36" stroke="currentColor" strokeWidth="1" /></svg>
      </div>
      <p className="perception-description">{mode.description}</p>
      <div className="photo-response-labels"><p><span className="cone-dot" />视锥：{mode.coneLabel}</p><p><span className="rod-dot" />视杆：{mode.rodLabel}</p></div>
      <p className="photo-small-note">图案是定性示意，不模拟亮度阈值、暗适应过程或个人视力。</p>
    </div>
  )
}
