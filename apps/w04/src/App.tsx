import { useCallback, useEffect, useRef, useState } from 'react';
import { createBasicSave } from './basic';
import { type ExperimentState } from './core';
import { storageKey, useLab } from './store';
import Controls, { Segments } from './Controls';
import Viewport from './Viewport';
import AnamorphEditor from './AnamorphEditor';

type WorkspaceTab = 'd09' | 'd10' | 'anamorph';
const tabKey = `${storageKey}:tab:v2`;
function initialTab(): WorkspaceTab {
  try { const tab = localStorage.getItem(tabKey); if (tab === 'd09' || tab === 'd10' || tab === 'anamorph') return tab; } catch {}
  return useLab.getState().save.activeModule === 'd10' ? 'd10' : 'd09';
}
const MODULES: { id: WorkspaceTab; label: string; title: string; description: string }[] = [
  { id: 'd09', label: '深度线索', title: '深度线索', description: '调整物体距离和大小，开关环境线索，比较深度感。' },
  { id: 'd10', label: '错位片场', title: '强迫透视', description: '调整球体距离，再横移机位，比较球体与托架的对齐关系。' },
  { id: 'anamorph', label: '反透视生成', title: '反透视图像生成', description: '把三维模型变成平面图像，再从指定视点还原立体效果。' },
];

export default function App() {
  const { save, pending, notice, edit, cancel, switchModule, notify } = useLab();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [anamorphVisited, setAnamorphVisited] = useState(() => initialTab() === 'anamorph');
  const module = activeTab === 'd10' ? 'd10' : 'd09';
  const state = save.modules[module];
  const meta = MODULES.find(item => item.id === activeTab)!;
  const [selected, setSelected] = useState('A');
  const [showSpace, setShowSpace] = useState(false);
  const [view, setView] = useState<'top' | 'free'>('free');
  const initialNotice = useRef(notice);
  const anamorphReset = useRef<(() => void) | null>(null);
  const setAnamorphReset = useCallback((reset: (() => void) | null) => { anamorphReset.current = reset; }, []);
  const anamorphSave = useRef<(() => boolean) | null>(null);
  const setAnamorphSave = useCallback((save: (() => boolean) | null) => { anamorphSave.current = save; }, []);
  const [courseNotice, setCourseNotice] = useState('');
  const returnToCourse = () => {
    try {
      const current = useLab.getState();
      if (current.pending) current.edit(current.save.modules[current.pending.module]);
      localStorage.setItem(storageKey, JSON.stringify(useLab.getState().save));
      localStorage.setItem(tabKey, activeTab);
      if (anamorphSave.current && !anamorphSave.current()) {
        setCourseNotice('反透视参数保存失败，请检查浏览器存储后重试。');
        return;
      }
      window.location.assign(new URL('../', window.location.href).href);
    } catch { setCourseNotice('当前设置无法保存，请检查浏览器存储后重试。'); }
  };

  useEffect(() => {
    try { localStorage.setItem(tabKey, activeTab); } catch {}
    if (activeTab !== 'anamorph' && save.activeModule !== activeTab) switchModule(activeTab);
  }, [activeTab, save.activeModule, switchModule]);

  useEffect(() => {
    setSelected(module === 'd09' ? 'A' : '');
    setShowSpace(false);
  }, [module]);

  useEffect(() => {
    if (pending) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(save)); }
      catch { notify('设置暂时无法保存，当前画面仍可继续操作。'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [save, pending, notify]);

  useEffect(() => {
    // Old advanced links must not silently apply controls absent from this interface.
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancel(); (document.activeElement as HTMLElement)?.blur?.(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [cancel]);

  const change = useCallback((next: ExperimentState, commit = true) => edit(next, commit), [edit]);
  const chooseModule = (next: WorkspaceTab) => { cancel(); setActiveTab(next); if (next === 'anamorph') setAnamorphVisited(true); else switchModule(next); };
  const reset = () => { if (activeTab === 'anamorph') anamorphReset.current?.(); else { cancel(); edit(createBasicSave().modules[module]); } };
  const select = (id: string) => {
    if (module === 'd09' && ['A', 'B', 'C'].includes(id)) setSelected(id);
  };
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  const error = notice !== initialNotice.current && /未应用修改|无法|无效/.test(notice) ? notice : '';

  return <div className="app simple-app">
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 38 38" aria-hidden="true"><path d="M5 11L19 4L33 11V27L19 34L5 27Z M5 11L19 19L33 11 M19 19V34" /></svg>
        <span>立体感知<span>空间实验室</span></span>
      </div>
      <nav aria-label="实验模块">
        {MODULES.map(item => <button key={item.id} aria-label={item.label} aria-pressed={item.id === activeTab} className={item.id === activeTab ? 'active' : ''} onClick={() => chooseModule(item.id)}>{item.label}</button>)}
      </nav>
      <div className="course-actions"><a className="course-home" href="../" onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();returnToCourse();}}>← 课程首页</a><button className="fullscreen-button" aria-label="全屏" title="全屏" onClick={fullscreen}>⛶</button></div>
    </header>

    <main>
      {courseNotice && <p className="course-notice" role="status">{courseNotice}</p>}
      <div className="experiment-heading">
        <div><h1>{meta.title}</h1><p>{meta.description}</p></div>
        <div className="experiment-actions">
          {activeTab !== 'anamorph' && <button className={showSpace ? 'active' : ''} aria-label={showSpace ? '收起空间' : '查看空间'} aria-pressed={showSpace} onClick={() => setShowSpace(value => !value)}>{showSpace ? '收起空间' : '查看空间'}</button>}
          <button aria-label="重置当前实验" onClick={reset}>重置</button>
        </div>
      </div>

      {activeTab !== 'anamorph' && <div className="workspace">
        <div className="scene-column">
          <Viewport simple state={state} selected={selected} onSelect={select} onChange={change}
            view={view} markers={false} depthColor={false} inspectVisible={showSpace}
            inspectToolbar={<div className="space-toolbar"><span>空间关系</span><Segments label="空间观察方式" value={view} options={[{ value: 'free', label: '自由观察' }, { value: 'top', label: '俯视' }]} onChange={setView} /></div>}
          />
        </div>
        <aside className="control-panel" aria-label="基础操作">
          <Controls state={state} selected={selected} onSelect={select} onChange={change} />
        </aside>
      </div>
      }
      {anamorphVisited && <div hidden={activeTab !== 'anamorph'} className="anamorph-panel"><AnamorphEditor onResetReady={setAnamorphReset} onSaveReady={setAnamorphSave} /></div>}
      {activeTab !== 'anamorph' && error && <p className="edit-error" role="status">{error}</p>}
    </main>
  </div>;
}
