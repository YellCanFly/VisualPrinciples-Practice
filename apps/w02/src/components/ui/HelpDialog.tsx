import { useEffect, useRef } from 'react'
import { Hand, Microscope, Mouse, MousePointer2, RotateCcw, X, ZoomIn } from 'lucide-react'

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="help-dialog" aria-labelledby="help-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="help-dialog-content">
        <button className="icon-button dialog-close" aria-label="关闭操作帮助" onClick={onClose}><X size={20} /></button>
        <span className="dialog-eyebrow">开启你的探索</span><h2 id="help-title">换个角度，认识眼球</h2>
        <p className="dialog-intro">自由操作模型，跟随视觉之旅，或走近视网膜里的感光细胞。</p>
        <div className="help-items">
          <div><Mouse size={21} /><span><strong>旋转模型</strong><small>按住鼠标左键拖动；触屏用单指拖动。</small></span></div>
          <div><ZoomIn size={21} /><span><strong>拉近或拉远</strong><small>滚动鼠标滚轮；触屏用双指捏合。</small></span></div>
          <div><Hand size={21} /><span><strong>平移模型</strong><small>按住鼠标右键拖动；触屏用双指拖动。</small></span></div>
          <div><MousePointer2 size={21} /><span><strong>认识结构</strong><small>点击模型、中文标注或结构列表，查看说明。</small></span></div>
          <div><Microscope size={21} /><span><strong>观察感光细胞</strong><small>选择“感光细胞”，在整体分布中定位中央凹、周边视网膜和视盘，再用“局部放大”观察细胞。切换教学光照，比较颜色与细节感知。</small></span></div>
          <div><RotateCcw size={21} /><span><strong>重新探索</strong><small>重置视角恢复当前教学视角。“返回视觉之旅”保留原进度；重新播放从当前步骤开头开始。</small></span></div>
        </div>
        <div className="help-extra">选择视觉步骤后将自动切到剖视并播放光线动画。进入感光细胞模式会暂停此动画；细胞的颜色、密度与感光贡献均为教学示意，科学资料可在右侧说明底部查阅。</div>
        <button className="play-button dialog-confirm" onClick={onClose}>开始探索</button><p className="dialog-escape">按 Esc 也可以关闭此窗口</p>
      </div>
    </dialog>
  )
}
