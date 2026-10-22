import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import { Range } from './Controls';
import { ANAMORPH_DEFAULTS, MODEL_OPTIONS, validateAnamorphParams, type AnamorphParams, type BuiltinModelId } from './anamorph-core';
import { disposeModel, importFbx, loadBuiltinModel } from './anamorph-models';
import AnamorphViewport, { type AnamorphViewportHandle } from './AnamorphViewport';
import './anamorph-editor.css';

export const anamorphStorageKey = `stereo-lab:${location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'}:anamorph:state:v1`;
function initialParams(): AnamorphParams {
  try {
    const saved = localStorage.getItem(anamorphStorageKey);
    if (saved) {
      const parsed = validateAnamorphParams(JSON.parse(saved));
      return parsed.modelId === 'fbx' ? { ...parsed, modelId: 'box' } : parsed;
    }
  } catch {}
  return { ...ANAMORPH_DEFAULTS };
}

export default function AnamorphEditor({ onResetReady, onSaveReady }: { onResetReady?: (reset: (() => void) | null) => void; onSaveReady?: (save: (() => boolean) | null) => void }) {
  const [params, setParams] = useState<AnamorphParams>(initialParams);
  const latestParams = useRef(params); latestParams.current = params;
  const [model, setModel] = useState<Group | null>(null);
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resolution, setResolution] = useState(2048);
  const [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const handle = useRef<AnamorphViewportHandle | null>(null);
  const activeModel = useRef<Group | null>(null);
  const loadedId = useRef<AnamorphParams['modelId'] | null>(null);
  const request = useRef(0);

  const replaceModel = useCallback((next: Group, id: AnamorphParams['modelId']) => {
    const previous = activeModel.current;
    activeModel.current = next;
    loadedId.current = id;
    setModel(next);
    if (previous) disposeModel(previous);
  }, []);

  useEffect(() => {
    if (params.modelId === 'fbx') return;
    const id = params.modelId, token = ++request.current;
    setLoading(true); setError(''); setMessage('');
    loadBuiltinModel(id).then(next => {
      if (request.current !== token) { disposeModel(next); return; }
      replaceModel(next, id); setFilename(''); setLoading(false);
    }).catch(cause => {
      if (request.current !== token) return;
      setError(`模型加载失败：${(cause as Error).message}`); setLoading(false);
      if (loadedId.current) setParams(current => ({ ...current, modelId: loadedId.current! }));
    });
  }, [params.modelId, replaceModel, reload]);

  useEffect(() => () => {
    ++request.current;
    if (activeModel.current) { disposeModel(activeModel.current); activeModel.current = null; }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { try { localStorage.setItem(anamorphStorageKey, JSON.stringify(params)); } catch {} }, 350);
    return () => clearTimeout(timer);
  }, [params]);

  const saveNow = useCallback(() => {
    try { localStorage.setItem(anamorphStorageKey, JSON.stringify(latestParams.current)); return true; }
    catch { setError('当前参数无法保存，请检查浏览器存储后重试。'); return false; }
  }, []);
  useEffect(() => { onSaveReady?.(saveNow); return () => onSaveReady?.(null); }, [onSaveReady, saveNow]);

  const reset = useCallback(() => {
    ++request.current;
    setParams({ ...ANAMORPH_DEFAULTS }); setError(''); setMessage('');
    setReload(value => value + 1);
    handle.current?.resetInspect();
  }, []);
  useEffect(() => { onResetReady?.(reset); return () => onResetReady?.(null); }, [onResetReady, reset]);
  const ready = useCallback((value: AnamorphViewportHandle) => { handle.current = value; }, []);
  const rendererError = useCallback((value: string) => setError(value), []);
  const patch = (field: keyof AnamorphParams, value: number | string) => {
    setParams(current => validateAnamorphParams({ ...current, [field]: value })); setMessage('');
  };

  const loadFbxFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.fbx')) { setError('请选择 FBX 模型文件。'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('FBX 文件超过 50MB，请先精简模型。'); return; }
    const token = ++request.current;
    setLoading(true); setError(''); setMessage('');
    try {
      const next = await importFbx(await file.arrayBuffer(), file.name);
      if (request.current !== token) { disposeModel(next); return; }
      replaceModel(next, 'fbx');
      setParams(current => ({ ...current, modelId: 'fbx' }));
      setFilename(file.name);
      setMessage(`已导入 ${file.name}`);
    } catch (cause) {
      if (request.current === token) setError(`FBX 导入失败，已保留原模型：${(cause as Error).message}`);
    } finally { if (request.current === token) setLoading(false); }
  };

  const exportPng = async () => {
    if (!model || loading) return;
    if (!handle.current) { setError('视图尚未就绪，请稍后重试。'); return; }
    setExporting(true); setError(''); setMessage('');
    try {
      const output = await handle.current.exportPng(resolution);
      const name = params.modelId === 'fbx' ? filename.replace(/\.fbx$/i, '') : MODEL_OPTIONS.find(option => option.id === params.modelId)?.label || 'model';
      const link = document.createElement('a');
      link.href = output.url; link.download = `反透视-${name}.png`;
      document.body.append(link); link.click(); link.remove();
      if (output.url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(output.url), 10000);
      setMessage(`已导出 ${output.width} × ${output.height} 透明 PNG`);
    } catch (cause) { setError(`导出失败：${(cause as Error).message}`); }
    finally { setExporting(false); }
  };

  return <div className="workspace anamorph-workspace">
    <div className="anamorph-views" aria-busy={loading}>
      <AnamorphViewport params={params} model={model} onReady={ready} onError={rendererError} />
      {loading && <div className="model-loading" role="status">正在加载模型…</div>}
    </div>
    <aside className="control-panel anamorph-controls" aria-label="反透视参数">
      <section className="anamorph-section">
        <h3>选择模型</h3>
        <select className="model-select" aria-label="内置模型" value={params.modelId} onChange={event => patch('modelId', event.target.value as BuiltinModelId)}>
          <optgroup label="几何体">{MODEL_OPTIONS.slice(0, 9).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>
          <optgroup label="经典模型">{MODEL_OPTIONS.slice(9).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>
          {params.modelId === 'fbx' && <option value="fbx">导入模型 · {filename}</option>}
        </select>
        <div className="import-color-row">
          <button className="import-fbx" disabled={loading || exporting} onClick={() => fileInput.current?.click()}>导入 FBX</button>
          <label className="model-color"><span>颜色</span><input type="color" aria-label="模型颜色" value={params.color} onChange={event => patch('color', event.target.value)} /></label>
        </div>
        <input ref={fileInput} type="file" data-testid="fbx-input" accept=".fbx" hidden onChange={event => { const selected = event.target.files?.[0]; if (selected) void loadFbxFile(selected); event.target.value = ''; }} />
        <Range label="模型转向" value={params.rotationDeg} min={-180} max={180} step={1} unit="°" onChange={value => patch('rotationDeg', value)} />
        {params.modelId === 'fbx' && <p className="import-note">静态网格 · 统一材质。刷新页面后需重新导入。</p>}
      </section>
      <section className="anamorph-section">
        <h3>指定观察视点</h3>
        <Range label="视点方向" value={params.azimuthDeg} min={-180} max={180} step={1} unit="°" onChange={value => patch('azimuthDeg', value)} />
        <Range label="视点俯角" value={params.elevationDeg} min={15} max={75} step={1} unit="°" onChange={value => patch('elevationDeg', value)} />
        <Range label="观察距离" value={params.distanceM} min={5} max={12} step={.1} unit="m" onChange={value => patch('distanceM', value)} />
      </section>
      <section className="anamorph-section anamorph-export">
        <div className="export-size-row"><span>PNG 长边</span><select aria-label="导出分辨率" value={resolution} onChange={event => setResolution(+event.target.value)}>{[1024, 2048, 4096].map(size => <option key={size} value={size}>{size} px</option>)}</select></div>
        <button className="export-anamorph" disabled={loading || !model || exporting} onClick={() => void exportPng()}>{exporting ? '正在导出…' : '导出透明PNG'}</button>
        <p className="export-note">导出平面变形图；透明底，打印时保持长宽比例。</p>
        {error && <p className="anamorph-message error" role="alert">{error}</p>}
        {!error && message && <p className="anamorph-message" role="status">{message}</p>}
      </section>
    </aside>
  </div>;
}
