import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clone, createDefaultSave, decodeShare, encodeShare, loadPreset, parseSave, type D09State, type D12State } from './core';

beforeEach(() => {
  vi.resetModules();
  const memory = new Map<string, string>();
  vi.stubGlobal('location', { pathname: '/course/stereo/', hash: '' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) });
});

describe('store transactions and validation', () => {
  it('shares exactly the same versioned URL format as the core parser', async () => {
    const { shareHash, readShare } = await import('./store');
    const state = loadPreset('d10-contact');
    expect(shareHash(state)).toBe(encodeShare(state));
    expect(readShare(encodeShare(state))).toEqual(state);
    expect(decodeShare(shareHash(state))).toEqual(state);
  });
  it('a complete drag produces one undo step, cancellation restores its start', async () => {
    const { useLab } = await import('./store'); const initial = clone(useLab.getState().save.modules.d09);
    for (const depthM of [7, 8, 9, 10]) {
      const state = clone(useLab.getState().save.modules.d09); state.targets[0].depthM = depthM;
      useLab.getState().edit(state, false);
    }
    expect(useLab.getState().histories.d09.past).toHaveLength(0);
    useLab.getState().edit(clone(useLab.getState().save.modules.d09), true);
    expect(useLab.getState().histories.d09.past).toHaveLength(1);
    useLab.getState().undo(); expect(useLab.getState().save.modules.d09).toEqual(initial);
    useLab.getState().redo(); expect(useLab.getState().save.modules.d09.targets[0].depthM).toBe(10);
    const drag = clone(useLab.getState().save.modules.d09); drag.targets[0].depthM = 11;
    useLab.getState().edit(drag, false); useLab.getState().cancel();
    expect(useLab.getState().save.modules.d09.targets[0].depthM).toBe(10);
    expect(useLab.getState().pending).toBeNull();
  });
  it('invalid edits preserve the last valid frame, pending transaction and history', async () => {
    const { useLab } = await import('./store');
    const first = clone(useLab.getState().save.modules.d09); first.targets[0].depthM = 9;
    useLab.getState().edit(first, false);
    const invalid = clone(first); invalid.targets[0].depthM = -3;
    useLab.getState().edit(invalid, false);
    expect(useLab.getState().save.modules.d09.targets[0].depthM).toBe(9);
    expect(useLab.getState().histories.d09.past).toHaveLength(0);
    expect(useLab.getState().pending).not.toBeNull();
    expect(useLab.getState().notice).toContain('未应用修改');
    useLab.getState().edit(first, true);
    expect(useLab.getState().histories.d09.past).toHaveLength(1);
    expect(parseSave(useLab.getState().save)).toEqual(useLab.getState().save);
  });
  it('rejects an invalid import atomically and can undo valid imports per module', async () => {
    const { useLab } = await import('./store'); const before = clone(useLab.getState().save);
    const invalid = createDefaultSave(); invalid.modules.d12.rig = { mode: 'dollyZoom', distanceM: 18, lockedQ: 1 };
    useLab.getState().importSave(invalid);
    expect(useLab.getState().save).toEqual(before); expect(useLab.getState().notice).toContain('导入失败');
    const valid = createDefaultSave(); valid.modules.d09 = loadPreset('d09-conflict') as D09State;
    valid.modules.d12 = loadPreset('d12-zoom') as D12State;
    useLab.getState().importSave(valid);
    expect(useLab.getState().save).toEqual(valid);
    useLab.getState().undo(); expect(useLab.getState().save.modules.d09).toEqual(before.modules.d09);
    useLab.getState().switchModule('d12'); useLab.getState().undo();
    expect(useLab.getState().save.modules.d12).toEqual(before.modules.d12);
  });
  it('retains fifty whole edits and preserves other modules across tab changes', async () => {
    const { useLab } = await import('./store');
    for (let i = 0; i < 65; i++) {
      const state = clone(useLab.getState().save.modules.d09); state.camera.focalMm = 20 + i;
      useLab.getState().edit(state);
    }
    const edited = clone(useLab.getState().save.modules.d09);
    expect(useLab.getState().histories.d09.past).toHaveLength(50);
    useLab.getState().switchModule('d10'); useLab.getState().edit(loadPreset('d10-giants'));
    useLab.getState().switchModule('d09');
    expect(useLab.getState().save.modules.d09).toEqual(edited);
    expect(useLab.getState().save.modules.d10.presetId).toBe('d10-giants');
  });
  it('uses normalized deployment paths to isolate local saves', async () => {
    const { storageKey } = await import('./store'); expect(storageKey).toBe('stereo-lab:/course/stereo:simple:state:v1');
  });
});
