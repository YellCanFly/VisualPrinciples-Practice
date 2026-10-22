import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone, moveObject, projectPoint, resolveExperiment, setD10Ndc, worldAnchor, type ExperimentState, type Vec3 } from './core';
import { captureExperiment, configureInspect, configureRenderer, projectedRightEdge, projectionStatus, SceneRig, shotCamera, type InspectView } from './engine';
import './viewport.css';

export interface ViewportHandle {
  capture(state?: ExperimentState, markers?: boolean, includeSpace?: boolean): Promise<string>;
  resetInspect(): void;
}
export interface ViewportProps {
  simple?: boolean;
  state: ExperimentState; selected: string; onSelect(id: string): void;
  onChange(next: ExperimentState, commit?: boolean): void;
  view: InspectView; markers: boolean; depthColor: boolean; inspectVisible?: boolean;
  onReady?(handle: ViewportHandle): void; onGestureStart?(): void; onGestureEnd?(): void;
  onWheelAction?(delta: number, shift: boolean): void; children?: ReactNode; inspectToolbar?: ReactNode;
}
type Drag = { id: string; pointer: number; start: ExperimentState; latest: ExperimentState; plane: THREE.Plane; offset: THREE.Vector3; element: HTMLElement; kind: 'object' | 'anchor' };

export function Viewport(props: ViewportProps) {
  const root = useRef<HTMLDivElement>(null), shot = useRef<HTMLDivElement>(null), space = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const engine = useRef<{ update(): void; resetInspect(): void } | null>(null);
  const [error, setError] = useState(''), [restart, setRestart] = useState(0), [dragging, setDragging] = useState(false);
  const [inspectGround, setInspectGround] = useState(true), [inspectWall, setInspectWall] = useState(false);
  const [inspectLabels, setInspectLabels] = useState<{id: string; label: string; x: number; y: number; depth: number; color: string}[]>([]);
  const inspectPreferences = useRef({ inspectGround, inspectWall }); inspectPreferences.current = { inspectGround, inspectWall };
  const resolved = useMemo(() => resolveExperiment(props.state), [props.state]);

  useEffect(() => {
    const host = root.current!, shotElement = shot.current!, spaceElement = space.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError(current.current.simple ? '三维画面暂时无法显示，请重试或启用浏览器硬件加速。' : '当前浏览器未能启动 WebGL2。请启用硬件加速，或换用支持 WebGL2 的浏览器。'); return; }
    setError(''); configureRenderer(renderer); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0); renderer.autoClear = false;
    const canvas = renderer.domElement; canvas.className = 'lab-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
    const shotRig = new SceneRig(), spaceRig = new SceneRig(true);
    let camera = shotCamera(resolveExperiment(current.current.state).camera);
    const inspect = new THREE.PerspectiveCamera(42, 2, .1, 150);
    const controls = new OrbitControls(inspect, spaceElement); controls.enableDamping = false; controls.minDistance = 5; controls.maxDistance = 80;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    let view = current.current.view, module = current.current.state.module;
    configureInspect(inspect, controls, view, module);
    let frame = 0, disposed = false, drag: Drag | null = null, labelKey = '';
    const raycaster = new THREE.Raycaster();
    const bounds = (element: HTMLElement) => element.getBoundingClientRect();
    function render() {
      frame = 0; if (disposed) return;
      const rect = bounds(host); if (!rect.width || !rect.height) return;
      const w = Math.round(rect.width), h = Math.round(rect.height);
      const size = renderer.getSize(new THREE.Vector2()); if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.clear(true, true, true); renderer.setScissorTest(true);
      for (const [element, scene, cam] of [[shotElement, shotRig.scene, camera], [spaceElement, spaceRig.scene, inspect]] as const) {
        if (element === spaceElement && current.current.inspectVisible === false) continue;
        const r = bounds(element); if (r.width < 1 || r.height < 1) continue;
        const x = r.left - rect.left, y = rect.bottom - r.bottom;
        if (cam === inspect) { inspect.aspect = r.width / r.height; inspect.updateProjectionMatrix(); }
        renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height); renderer.clear(true, true, true); renderer.render(scene, cam);
      }
      if (current.current.inspectVisible !== false) {
        const result = resolveExperiment(current.current.state);
        const labels = result.measurements.map(m => {
          const object = result.objects.find(o => o.id === m.id)!;
          const p = new THREE.Vector3().fromArray(worldAnchor(object, 'contact')).project(inspect);
          return { id: m.id, label: m.id.length < 4 ? m.id : m.label.split(' · ')[0], x: (p.x + 1) * 50, y: (1 - p.y) * 50, depth: m.depthM, color: object.color };
        }).filter(p => p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100);
        const nextKey = JSON.stringify(labels); if (nextKey !== labelKey) { labelKey = nextKey; setInspectLabels(labels); }
      }
    }
    function requestRender() { if (!frame && !disposed) frame = requestAnimationFrame(render); }
    function finish(cancel = false) {
      if (!drag) return;
      const finished = drag; drag = null;
      if (finished.element.hasPointerCapture(finished.pointer)) finished.element.releasePointerCapture(finished.pointer);
      controls.enabled = true; setDragging(false);
      current.current.onChange(cancel ? finished.start : finished.latest, true); current.current.onGestureEnd?.(); requestRender();
    }
    function update() {
      const p = current.current;
      if (p.state.module !== module || p.view !== view) {
        if (drag) finish(true);
        view = p.view; module = p.state.module; configureInspect(inspect, controls, view, module);
      }
      const result = resolveExperiment(p.state); camera = shotCamera(result.camera);
      shotRig.update(result, p.selected, p.simple ? false : p.depthColor, true, false, Boolean(p.simple && result.module === 'd10'));
      spaceRig.update(result, p.selected, false, inspectPreferences.current.inspectGround, inspectPreferences.current.inspectWall);
      controls.mouseButtons.LEFT = view === 'free' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
      controls.touches.ONE = view === 'free' ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      requestRender();
    }
    function ray(event: PointerEvent, element: HTMLElement, cam: THREE.Camera) {
      const r = bounds(element); raycaster.setFromCamera(new THREE.Vector2((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1), cam);
      return raycaster;
    }
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const p = current.current, element = event.currentTarget as HTMLElement;
      element.focus({ preventScroll: true });
      const result = resolveExperiment(p.state);
      if (element === shotElement && !p.simple && p.markers && p.state.module === 'd10' && p.state.phase === 'edit' && p.state.mode === 'align') {
        const point = result.alignment?.a;
        const r = bounds(shotElement);
        if (point?.valid && Math.hypot(event.clientX - r.left - point.u * r.width, event.clientY - r.top - point.v * r.height) < 28) {
          const reference = result.referenceCamera!;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().fromArray(reference.quaternion));
          const referencePoint = new THREE.Vector3().fromArray(reference.position).addScaledVector(forward, p.state.nearDepthM);
          drag = { id: '', pointer: event.pointerId, start: clone(p.state), latest: clone(p.state), plane: new THREE.Plane().setFromNormalAndCoplanarPoint(forward, referencePoint), offset: new THREE.Vector3(), element, kind: 'anchor' };
        }
      }
      if (!drag) {
        const handleId = element === spaceElement ? (event.target as HTMLElement).closest<HTMLElement>('[data-object-handle]')?.dataset.objectHandle : undefined;
        const hit = ray(event, element, element === shotElement ? camera : inspect).intersectObjects(element === shotElement ? shotRig.objects.children : [...spaceRig.objects.children, ...spaceRig.helpers.children], true).find(hit => hit.object.userData.objectId);
        if (!hit && !handleId) return;
        const id = handleId ?? hit!.object.userData.objectId as string; p.onSelect(id);
        if (element === shotElement || p.state.module === 'd12' || (p.state.module === 'd10' && (p.state.phase !== 'edit' || p.state.mode !== 'free'))) return;
        const object = result.objects.find(o => o.id === id); if (!object || object.kind === 'occluder') return;
        const position = new THREE.Vector3().fromArray(object.transform.position);
        const normal = view === 'side' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, position);
        const hitPlane = raycaster.ray.intersectPlane(plane, new THREE.Vector3()); if (!hitPlane) return;
        drag = { id, pointer: event.pointerId, start: clone(p.state), latest: clone(p.state), plane, offset: hitPlane.clone().sub(position), element, kind: 'object' };
      }
      event.preventDefault(); event.stopImmediatePropagation(); controls.enabled = false;
      element.setPointerCapture(event.pointerId); setDragging(true); p.onGestureStart?.(); p.onChange(clone(p.state), false);
    }
    function pointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointer) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (drag.kind === 'anchor' && drag.start.module === 'd10') {
        const world = ray(event, shotElement, camera).ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (!world) return;
        const referencePoint = projectPoint(world.toArray() as Vec3, drag.start.referenceCamera);
        if (!referencePoint.valid) return;
        drag.latest = setD10Ndc(drag.start, referencePoint.ndc);
      } else {
        const point = ray(event, spaceElement, inspect).ray.intersectPlane(drag.plane, new THREE.Vector3()); if (!point) return;
        point.sub(drag.offset); drag.latest = moveObject(drag.start, drag.id, point.toArray() as Vec3);
      }
      current.current.onChange(drag.latest, false);
    }
    const pointerUp = (event: PointerEvent) => { if (drag && event.pointerId === drag.pointer) { event.stopImmediatePropagation(); finish(false); } };
    const pointerCancel = () => finish(true);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); finish(true); } };
    const wheel = (event: WheelEvent) => { if (document.activeElement !== shotElement || !current.current.onWheelAction) return; event.preventDefault(); current.current.onWheelAction(event.deltaY, event.shiftKey); };
    const leaveShot = () => { if (document.activeElement === shotElement && !drag) shotElement.blur(); };
    const contextLost = (event: Event) => { event.preventDefault(); setError('三维画面已暂停，请点击重试。'); };
    controls.addEventListener('change', requestRender);
    for (const el of [shotElement, spaceElement]) {
      el.addEventListener('pointerdown', pointerDown, true); el.addEventListener('pointermove', pointerMove, true);
      el.addEventListener('pointerup', pointerUp, true); el.addEventListener('pointercancel', pointerCancel, true);
    }
    document.addEventListener('keydown', key); window.addEventListener('blur', pointerCancel);
    shotElement.addEventListener('wheel', wheel, { passive: false }); shotElement.addEventListener('pointerleave', leaveShot);
    canvas.addEventListener('webglcontextlost', contextLost);
    const observer = new ResizeObserver(requestRender); observer.observe(host); observer.observe(shotElement); observer.observe(spaceElement);
    window.addEventListener('resize', requestRender); window.addEventListener('scroll', requestRender, true);
    engine.current = { update, resetInspect() { configureInspect(inspect, controls, current.current.view, current.current.state.module); requestRender(); } };
    current.current.onReady?.({
      capture: (state = current.current.state, markers = current.current.markers, includeSpace = false) => captureExperiment(state, markers, includeSpace, current.current.selected, current.current.view, current.current.depthColor, { position: inspect.position.toArray(), quaternion: inspect.quaternion.toArray(), up: inspect.up.toArray(), fov: inspect.fov }),
      resetInspect() { engine.current?.resetInspect(); },
    });
    update();
    return () => {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      if (drag) { if (drag.element.hasPointerCapture(drag.pointer)) drag.element.releasePointerCapture(drag.pointer); current.current.onGestureEnd?.(); drag = null; }
      observer.disconnect(); controls.removeEventListener('change', requestRender); controls.dispose();
      for (const el of [shotElement, spaceElement]) { el.removeEventListener('pointerdown', pointerDown, true); el.removeEventListener('pointermove', pointerMove, true); el.removeEventListener('pointerup', pointerUp, true); el.removeEventListener('pointercancel', pointerCancel, true); }
      document.removeEventListener('keydown', key); window.removeEventListener('blur', pointerCancel);
      shotElement.removeEventListener('wheel', wheel); shotElement.removeEventListener('pointerleave', leaveShot); canvas.removeEventListener('webglcontextlost', contextLost);
      window.removeEventListener('resize', requestRender); window.removeEventListener('scroll', requestRender, true);
      shotRig.dispose(); spaceRig.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); engine.current = null;
    };
  }, [restart]);

  useEffect(() => { engine.current?.update(); }, [props.state, props.selected, props.view, props.markers, props.depthColor, props.inspectVisible, props.simple, inspectGround, inspectWall]);

  const projected = resolved.measurements.filter(m => m.top.valid && m.bottom.valid);
  const isAlign = props.state.module === 'd10' && props.state.mode === 'align' && props.state.phase === 'edit';
  return <div className={`viewport-system ${props.simple ? 'simple-viewport' : ''}`} ref={root}>
    <section className="shot-card">
      {!props.simple && <div className="viewport-heading"><span><i className="live-dot" />主取景 <small>拍摄相机</small></span><span className="viewport-meta">{resolved.camera.focalMm.toFixed(1)} mm <b>·</b> 16:9</span></div>}
      <div className={`shot-stage ${dragging ? 'is-dragging' : ''}`} ref={shot} tabIndex={0} role="group" aria-label={props.simple ? '实验场景，点击选择物体' : '拍摄相机取景，点击选择物体，聚焦后滚轮变焦'} data-testid="shot-viewport">
        {error ? <div className="webgl-fallback" role="alert"><svg viewBox="0 0 600 220" aria-label="空间关系静态示意"><path d="M20 190L300 40L580 190M20 190H580M100 190L300 40L500 190" fill="none" stroke="#4a6b73"/><rect x="140" y="85" width="48" height="105" fill="#e9b457"/><rect x="290" y="72" width="32" height="70" fill="#5fbcb9"/><rect x="390" y="65" width="23" height="50" fill="#829fc4"/><text x="148" y="145" fill="#10212b" fontSize="28">A</text><text x="295" y="115" fill="#10212b" fontSize="22">B</text></svg><p>{error}</p><button onClick={() => setRestart(n => n + 1)}>重试三维渲染</button></div> : props.simple ? null : <>
          <span className="shot-corner-label">{props.depthColor ? '深度伪彩 · 几何解释' : 'LIVE VIEW'}</span>
          {projectionStatus(resolved) && <span className="projection-status">{projectionStatus(resolved)}<small>数值保留未裁切的投影范围</small></span>}
          <span className="shot-sensor-label">36 × 20.25 mm</span>
          {props.markers && <svg className="projection-overlay" viewBox="0 0 1920 1080" aria-label="投影高度与几何锚点测量">
            <defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#fff4d5" strokeWidth="1.5"/></marker></defs>
            <path className="center-cross" d="M946 540H974M960 526V554" />
            {projected.map(m => {
              if (!m.top.valid || !m.bottom.valid || !m.center.valid) return null;
              const object = resolved.objects.find(o => o.id === m.id)!;
              const x = projectedRightEdge(object, resolved.camera) * 1920 + 24, t = m.top.v * 1080, b = m.bottom.v * 1080;
              return <g key={m.id} stroke={object.color} className={m.id === props.selected ? 'selected-measure' : ''}>
                <path d={`M${x} ${t}V${b}M${x - 12} ${t}H${x + 12}M${x - 12} ${b}H${x + 12}`} strokeWidth="2" strokeDasharray="8 6" fill="none" />
              </g>;
            })}
            {props.state.module === 'd09' && Math.abs(props.state.camera.position[0]) > .005 && resolved.measurements.map(m => {
              const object = resolved.objects.find(o => o.id === m.id)!;
              const point: Vec3 = [object.transform.position[0], object.dimensions[1] * object.transform.scale[1] / 2, object.transform.position[2]];
              const origin = projectPoint(point, { ...resolved.camera, position: [0, resolved.camera.position[1], resolved.camera.position[2]] });
              if (!origin.valid || !m.center.valid) return null;
              return <g key={`motion-${m.id}`}><circle cx={origin.u * 1920} cy={origin.v * 1080} r="6" fill="none" stroke="#fff4d5"/><path d={`M${origin.u * 1920} ${origin.v * 1080}L${m.center.u * 1920} ${m.center.v * 1080}`} stroke="#fff4d5" strokeWidth="2" markerEnd="url(#arrowhead)"/></g>;
            })}
            {resolved.alignment?.a.valid && resolved.alignment.b.valid && <g>
              <path d={`M${resolved.alignment.a.u * 1920} ${resolved.alignment.a.v * 1080}L${resolved.alignment.b.u * 1920} ${resolved.alignment.b.v * 1080}`} stroke="#fff4da" strokeWidth="3" strokeDasharray="8 6"/>
              <circle cx={resolved.alignment.a.u * 1920} cy={resolved.alignment.a.v * 1080} r="16" fill="none" stroke="#ffd080" strokeWidth="4"/>
              <circle cx={resolved.alignment.b.u * 1920} cy={resolved.alignment.b.v * 1080} r="11" fill="none" stroke="#65ddd7" strokeWidth="4"/>
              <text x={resolved.alignment.a.u * 1920 + 24} y={resolved.alignment.a.v * 1080 - 24} fill="#fff3d2" fontSize="25">{isAlign ? '拖动参考接触点' : '几何参考点'}</text>
            </g>}
          </svg>}
          {props.markers && projected.map(m => {
            if (!m.top.valid || !m.bottom.valid) return null;
            const object = resolved.objects.find(o => o.id === m.id)!;
            const x = projectedRightEdge(object, resolved.camera) * 100 + 1.5;
            return <span key={`label-${m.id}`} className="projection-value" style={{left: `clamp(8px, ${x}%, calc(100% - 90px))`, top: `clamp(40px, ${(m.top.v + m.bottom.v) * 50}%, calc(100% - 26px))`, borderLeftColor: object.color}}>{m.id.length < 4 ? m.id : m.id === 'subject' ? '主体' : m.id === 'background' ? '背景' : m.label.split(' · ')[0]} · {((m.projectedHeight ?? 0) * 100).toFixed(1)}%{!m.inFrame && <small>部分出框</small>}</span>;
          })}
          {props.depthColor && <div className="depth-legend"><span>光轴深度</span><i/><span>0</span><span>15</span><span>30m+</span></div>}
        </>}
      </div>
      {!props.simple && <div className="viewport-instruction"><span>{isAlign ? '拖动金青锚点，改变参考画面接触位置' : '点击物体选择 · 点击画面后滚轮变焦 · Shift + 滚轮移动机位'}</span><span>{dragging ? '拖动中 · Esc 取消' : '固定画幅 / 实时投影'}</span></div>}
    </section>
    <div className={`analysis-row ${props.inspectVisible === false ? 'inspect-hidden' : ''}`} style={{ display: props.inspectVisible === false && !props.children ? 'none' : undefined }}>
      <section className="inspect-card" style={{ display: props.inspectVisible === false ? 'none' : undefined }}>
        {!props.simple && <div className="viewport-heading"><span>空间关系 <small>观察空间</small></span><button className="inspect-reset" onClick={() => engine.current?.resetInspect()} title="恢复观察视角" aria-label="恢复观察视角">↺</button></div>}
        {props.inspectToolbar && <div className="inspect-toolbar">{props.inspectToolbar}</div>}
        <div className="inspect-stage" ref={space} tabIndex={0} role="group" aria-label="独立空间观察视图，拖动物体平面手柄或空白处观察" data-testid="inspect-viewport">{!props.simple && <span className="space-view-tag">{props.view === 'top' ? '俯视 / XZ 平面' : props.view === 'side' ? '侧视 / YZ 平面' : '自由观察 / 地面平移'}</span>}{inspectLabels.filter(() => !props.simple || props.state.module === 'd09').map(label => <span key={label.id} data-object-handle={label.id} className={`object-handle ${props.selected === label.id ? 'selected' : ''}`} style={{ left: `${label.x}%`, top: `${label.y}%`, color: label.color }}><i>＋</i>{!props.simple && <b>{label.label} <small>{label.depth.toFixed(1)}m</small></b>}</span>)}</div>
        {props.simple ? <div className="inspect-footer simple-inspect-footer">拖动观察空间</div> : <div className="inspect-footer"><span>{props.state.module === 'd12' ? '拖动空白处观察 · 滚轮缩放' : props.state.module === 'd10' && (props.state.phase === 'observe' || props.state.mode !== 'free') ? '几何已约束 · 自由摆拍可拖动物体' : '拖动物体移动 · 拖动空白观察'}</span><div><label><input type="checkbox" checked={inspectGround} onChange={e => setInspectGround(e.target.checked)}/>地面</label><label><input type="checkbox" checked={inspectWall} onChange={e => setInspectWall(e.target.checked)}/>墙体</label></div></div>}
      </section>
      {props.children && <div className="viewport-feedback">{props.children}</div>}
    </div>
  </div>;
}

export default Viewport;
