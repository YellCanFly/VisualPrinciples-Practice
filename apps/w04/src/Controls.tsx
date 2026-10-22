import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Quaternion, Vector3 } from 'three';
import {
  cameraQuaternion, clamp, clone, getDollyDistanceBounds, projectPoint,
  resolveExperiment, scaleAroundCamera, setD09SizeMode, setD09TargetKind,
  setD10Phase, setDollyDistance, setLensMode, worldAnchor,
  type D09State, type D10State, type D12State, type ExperimentState,
} from './core';

type Change = (state: ExperimentState, commit?: boolean) => void;

export function Range({ label, value, min, max, step = .1, unit = '', disabled = false, onChange, onStart, onCancel }: {
  label: string; value: number; min: number; max: number; step?: number | 'any'; unit?: string;
  disabled?: boolean; onChange: (value: number, commit: boolean) => void;
  onStart?: () => void; onCancel?: () => void;
}) {
  const latest = useRef(value), start = useRef(value), active = useRef(false);
  latest.current = value;
  const begin = () => {
    if (active.current) return;
    active.current = true; start.current = value; onStart?.();
  };
  const finish = () => {
    if (!active.current) return;
    active.current = false; onChange(latest.current, true);
  };
  const cancel = () => {
    if (!active.current) return;
    active.current = false;
    if (onCancel) onCancel(); else onChange(start.current, true);
  };
  const digits = step === 'any' ? 2 : step >= 1 ? 0 : step >= .1 ? 1 : 2;
  return <label className={`basic-range${disabled ? ' disabled' : ''}`}>
    <span className="range-heading"><span>{label}</span><output className="range-value">{Number(value.toFixed(digits))}{unit && ` ${unit}`}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled}
      style={{ '--fill': `${100 * (value - min) / Math.max(max - min, Number.EPSILON)}%` } as CSSProperties}
      onPointerDown={begin}
      onChange={event => { begin(); latest.current = clamp(+event.target.value, min, max); onChange(latest.current, false); }}
      onPointerUp={finish} onPointerCancel={cancel} onBlur={finish}
      onKeyDown={event => { if (event.key === 'Escape') cancel(); else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) begin(); }}
      onKeyUp={event => { if (event.key !== 'Escape') finish(); }} />
  </label>;
}

export function Segments<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string;
}) {
  return <div className="segments" role="group" aria-label={label}>{options.map(option =>
    <button key={option.value} className={option.value === value ? 'active' : ''} aria-pressed={option.value === value}
      onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="basic-section"><h3>{title}</h3>{children}</section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="basic-toggle"><span>{label}</span><input type="checkbox" checked={checked}
    aria-label={label} onChange={event => onChange(event.target.checked)} /><span className="toggle" aria-hidden="true" /></label>;
}

function DepthControls({ state, selected, onSelect, onChange }: {
  state: D09State; selected: string; onSelect: (id: string) => void; onChange: Change;
}) {
  const target = state.targets.find(item => item.id === selected) || state.targets[0];
  const height = resolveExperiment(state).measurements.find(item => item.id === target.id)!.heightM;
  const patch = (change: (next: D09State) => void, commit = true) => { const next = clone(state); change(next); onChange(next, commit); };
  return <div className="basic-controls">
    <Section title="物体"><Segments label="选择目标" value={target.id} options={state.targets.map(item => ({ value: item.id, label: item.id }))} onChange={onSelect} />
      <Range label="离相机多远" value={target.depthM} min={3} max={24} unit="m" onChange={(value, commit) => patch(next => { next.targets.find(item => item.id === target.id)!.depthM = value; }, commit)} />
      <Range label="物体高度" value={height} min={.4} max={4} step={.05} unit="m" disabled={state.sizeMode === 'equalImage'}
        onChange={(value, commit) => patch(next => { if (next.sizeMode === 'equalWorld') next.masterHeightM = value; else next.targets.find(item => item.id === target.id)!.heightM = value; }, commit)} />
      <Toggle label="画面一样大" checked={state.sizeMode === 'equalImage'} onChange={checked => onChange(setD09SizeMode(setD09TargetKind(state, 'card'), checked ? 'equalImage' : 'free'))} />
      <Range label="相机横移" value={state.camera.position[0]} min={-1} max={1} step={.01} unit="m"
        onChange={(value, commit) => patch(next => { next.camera.position[0] = value; }, commit)} />
    </Section>
    <Section title="深度线索"><div className="cue-toggles">
      <Toggle label="背景透视环境" checked={state.cues.wall || state.cues.door} onChange={checked => patch(next => { next.cues.wall = checked; next.cues.door = checked; })} />
      <Toggle label="地面" checked={state.cues.ground} onChange={checked => patch(next => { next.cues.ground = checked; })} />
      <Toggle label="地面网格" checked={state.cues.grid} onChange={checked => patch(next => { next.cues.grid = checked; })} />
      <Toggle label="阴影" checked={state.cues.shadows} onChange={checked => patch(next => { next.cues.shadows = checked; })} />
      <Toggle label="雾" checked={state.cues.fogDensity > 0} onChange={checked => patch(next => { next.cues.fogDensity = checked ? .04 : 0; })} />
      <Toggle label="遮挡板" checked={state.cues.occluder} onChange={checked => patch(next => { next.cues.occluder = checked; })} />
    </div></Section>
  </div>;
}

function ForcedControls({ state, onChange }: { state: D10State; onChange: Change }) {
  const distanceStart = useRef<D10State | null>(null);
  const resolved = resolveExperiment(state);
  const projection = projectPoint(worldAnchor(resolved.objects[1], 'contact'), state.referenceCamera);
  const distance = projection.depthM;
  const referenceRotation = new Quaternion(...cameraQuaternion(state.referenceCamera));
  const offset = new Vector3(...state.camera.position).sub(new Vector3(...state.referenceCamera.position))
    .applyQuaternion(referenceRotation.clone().invert());

  const changeDistance = (value: number, commit: boolean) => {
    const start = distanceStart.current || clone(state);
    distanceStart.current = start;
    const objects = resolveExperiment(start).objects;
    const depth = projectPoint(worldAnchor(objects[1], 'contact'), start.referenceCamera).depthM;
    if (depth <= 0) return;
    const next = clone(start);
    next.objects = clone(objects);
    // Always evaluate from this gesture's frozen transform, never the previous frame.
    next.objects[1].transform = scaleAroundCamera(start.referenceCamera, objects[1].transform, value / depth);
    next.baselineObjects = clone(next.objects);
    next.mode = 'rayScale'; next.phase = 'observe'; next.k = 1;
    next.farDepthM = value; next.farScale = next.objects[1].transform.scale[1];
    onChange(next, commit);
    if (commit) distanceStart.current = null;
  };
  return <div className="basic-controls">
    <Section title="摆放球体"><Range label="球体距离" value={distance} min={9} max={36} unit="m"
      onStart={() => { distanceStart.current = clone(state); }}
      onCancel={() => { if (distanceStart.current) onChange(distanceStart.current, true); distanceStart.current = null; }}
      onChange={changeDistance} /></Section>
    <Section title="换个位置看"><Range label="移动观察机位" value={offset.x} min={-.8} max={.8} step={.01} unit="m"
      onChange={(value, commit) => {
        const next = setD10Phase(state, 'observe');
        const local = offset.clone(); local.x = value;
        next.camera.position = local.applyQuaternion(referenceRotation).add(new Vector3(...state.referenceCamera.position)).toArray() as [number, number, number];
        onChange(next, commit);
      }} />
      <button className="return-front" onClick={() => { const next = setD10Phase(state, 'observe'); next.camera = clone(next.referenceCamera); onChange(next); }}>回到正面</button>
    </Section>
  </div>;
}

function LensControls({ state, onChange }: { state: D12State; onChange: Change }) {
  const gestureStart = useRef<D12State | null>(null);
  const startGesture = () => { gestureStart.current = clone(state); };
  const cancelGesture = () => { if (gestureStart.current) onChange(gestureStart.current, true); gestureStart.current = null; };
  const finishChange = (next: D12State, commit: boolean) => { onChange(next, commit); if (commit) gestureStart.current = null; };
  const linked = state.rig.mode === 'dollyZoom';
  const focal = resolveExperiment(state).camera.focalMm;
  const exactBounds = state.rig.mode === 'dollyZoom' ? getDollyDistanceBounds([18, 100], [3, 18], 2, state.rig.lockedQ) : [3, 18];
  // Anchor the slider to hundredths, so values such as 6m and 12m stay exactly reachable.
  const innerBounds = [Math.ceil((exactBounds[0] - 1e-10) * 100) / 100, Math.floor((exactBounds[1] + 1e-10) * 100) / 100];
  const bounds = [Math.min(innerBounds[0], state.rig.distanceM), Math.max(innerBounds[1], state.rig.distanceM)];
  const distanceStep = Math.abs(state.rig.distanceM * 100 - Math.round(state.rig.distanceM * 100)) > 1e-6 ? 'any' : .01;
  return <div className="basic-controls">
    <Section title="镜头与机位"><Range label="焦距" value={focal} min={18} max={100} step={1} unit="mm" disabled={linked} onStart={startGesture} onCancel={cancelGesture}
      onChange={(value, commit) => { const next = setLensMode(state, 'zoom'); if (next.rig.mode !== 'dollyZoom') next.rig.focalMm = value; finishChange(next, commit); }} />
      <Range label="相机距离" value={state.rig.distanceM} min={bounds[0]} max={bounds[1]} step={distanceStep} unit="m" onStart={startGesture} onCancel={cancelGesture}
        onChange={(value, commit) => finishChange(setDollyDistance(linked ? state : setLensMode(state, 'dolly'), clamp(Math.round(value * 100) / 100, innerBounds[0], innerBounds[1])), commit)} />
      <Toggle label="主体大小不变" checked={linked} onChange={checked => onChange(setLensMode(state, checked ? 'dollyZoom' : 'zoom'))} />
      <p className="control-note">开启后，移动相机会自动调整焦距。</p>
    </Section>
  </div>;
}

export default function Controls({ state, selected, onSelect, onChange }: {
  state: ExperimentState; selected: string; onSelect: (id: string) => void; onChange: Change;
}) {
  if (state.module === 'd09') return <DepthControls state={state} selected={selected} onSelect={onSelect} onChange={onChange} />;
  if (state.module === 'd10') return <ForcedControls state={state} onChange={onChange} />;
  return <LensControls state={state} onChange={onChange} />;
}
