import { create } from 'zustand';
import { createBasicSave } from './basic';
import { clone, createDefaultSave, decodeShare, encodeShare, parseSave, parseExperiment, type AppSave, type ExperimentState, type ModuleId } from './core';

export const storageKey = `stereo-lab:${location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'}:simple:state:v1`;
export const shareHash = (state: ExperimentState): string => encodeShare(state);
export function readShare(hash: string): ExperimentState | undefined {
  if (!new URLSearchParams(hash.replace(/^#/, '')).has('m')) return;
  return decodeShare(hash) ?? undefined;
}
let initial = createBasicSave();
let initialNotice = '';
try { const saved = localStorage.getItem(storageKey); if (saved) initial = parseSave(JSON.parse(saved)); } catch { initialNotice = '本地设置无法恢复，已载入默认实验。'; }

export interface Snapshot { state: ExperimentState; image: string; capturedAt: string; markers: boolean }
type History = { past: ExperimentState[]; future: ExperimentState[] };
interface LabStore {
  save: AppSave; notice: string; pending: ExperimentState | null;
  histories: Record<ModuleId, History>;
  snapshots: Record<ModuleId, { A?: Snapshot; B?: Snapshot }>;
  edit: (state: ExperimentState, commit?: boolean) => void;
  cancel: () => void; undo: () => void; redo: () => void;
  switchModule: (module: ModuleId) => void;
  notify: (message: string) => void;
  setSnapshot: (slot: 'A' | 'B', snapshot: Snapshot) => void;
  importSave: (save: AppSave) => void;
}
export const useLab = create<LabStore>((set, get) => ({
  save: initial, notice: initialNotice, pending: null,
  histories: { d09: { past: [], future: [] }, d10: { past: [], future: [] }, d12: { past: [], future: [] } },
  snapshots: { d09: {}, d10: {}, d12: {} },
  notify: notice => set({ notice }),
  edit: (next, commit = true) => {
    // Zod validates only the edited module; no DOM, scene resolution or storage work
    // runs here. Invalid pointer/number edits keep the last valid frame and history.
    try { next = parseExperiment(next); }
    catch (error) {
      const notice = `未应用修改：${(error as Error).message}`;
      if (get().notice !== notice) set({ notice });
      return;
    }
    const current = get(), module = next.module, old = current.save.modules[module];
    const start = current.pending?.module === module ? current.pending : old;
    const histories = { ...current.histories };
    if (commit && JSON.stringify(start) !== JSON.stringify(next)) histories[module] = { past: [...histories[module].past, clone(start)].slice(-50), future: [] };
    set({ save: { ...current.save, modules: { ...current.save.modules, [module]: next } }, pending: commit ? null : clone(start), histories });
  },
  cancel: () => { const { pending, save } = get(); if (pending) set({ save: { ...save, modules: { ...save.modules, [pending.module]: pending } }, pending: null }); },
  undo: () => {
    get().cancel(); const { save, histories } = get(), module = save.activeModule, h = histories[module];
    if (!h.past.length) return;
    set({ save: { ...save, modules: { ...save.modules, [module]: clone(h.past.at(-1)!) } }, histories: { ...histories, [module]: { past: h.past.slice(0, -1), future: [clone(save.modules[module]), ...h.future] } }, notice: '已撤销一次编辑。' });
  },
  redo: () => {
    get().cancel(); const { save, histories } = get(), module = save.activeModule, h = histories[module];
    if (!h.future.length) return;
    set({ save: { ...save, modules: { ...save.modules, [module]: clone(h.future[0]) } }, histories: { ...histories, [module]: { past: [...h.past, clone(save.modules[module])], future: h.future.slice(1) } }, notice: '已重做一次编辑。' });
  },
  switchModule: activeModule => { get().cancel(); set({ save: { ...get().save, activeModule } }); },
  setSnapshot: (slot, snapshot) => set(s => ({ snapshots: { ...s.snapshots, [snapshot.state.module]: { ...s.snapshots[snapshot.state.module], [slot]: snapshot } } })),
  importSave: save => {
    try { save = parseSave(save); }
    catch (error) { set({ notice: `导入失败，已保留当前工作：${(error as Error).message}` }); return; }
    get().cancel(); const current = get(), histories = { ...current.histories };
    for (const module of ['d09', 'd10', 'd12'] as const) histories[module] = { past: [...histories[module].past, clone(current.save.modules[module])].slice(-50), future: [] };
    set({ save: clone(save), histories, notice: '已导入全部实验。各模块均可撤销本次导入。' });
  },
}));
