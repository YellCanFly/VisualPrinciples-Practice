import { ArrowLeft, CircleHelp } from 'lucide-react'

export default function Header({ onHelp }: { onHelp: () => void }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none"><path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20Z" stroke="currentColor" strokeWidth="2" /><circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="2" /><circle cx="20" cy="20" r="2" fill="currentColor" /><path d="m29 7 2-3M33 11l4-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <div className="brand-name">视界实验室<small>眼球视觉原理 · 交互式 3D 探索</small></div>
        </div>
        <div className="header-actions">
          <a className="course-home" href="../"><ArrowLeft size={16} aria-hidden="true" />课程首页</a>
          <span className="learning-badge"><span />交互学习模式</span>
          <span className="header-divider" />
          <button className="help-button" onClick={onHelp}><CircleHelp size={17} />操作帮助</button>
        </div>
      </div>
    </header>
  )
}
