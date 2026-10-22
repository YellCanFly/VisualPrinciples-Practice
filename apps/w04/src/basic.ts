import { createDefaultSave, loadPreset, setD10Phase, type AppSave, type D10State, type D12State } from './core';

/** The classroom interface starts with only the conditions exposed by its controls. */
export function createBasicSave(): AppSave {
  const save = createDefaultSave();
  save.modules.d10 = setD10Phase(loadPreset('d10-ray-scale') as D10State, 'observe');
  save.modules.d12 = loadPreset('d12-zoom') as D12State;
  return save;
}
