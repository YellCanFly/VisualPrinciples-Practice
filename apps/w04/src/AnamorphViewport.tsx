import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODEL_CENTER, type AnamorphParams } from './anamorph-core';
import { AnamorphRig, configureAnamorphRenderer, exportAnamorphPng } from './anamorph-engine';
import './anamorph-viewport.css';

export interface AnamorphViewportHandle {
  exportPng(maxSize?: number): Promise<{ url: string; width: number; height: number }>;
  resetInspect(): void;
}
export interface AnamorphViewportProps {
  params: AnamorphParams;
  model: THREE.Object3D | null;
  onReady?(handle: AnamorphViewportHandle): void;
  onError?(message: string): void;
}

export default function AnamorphViewport(props: AnamorphViewportProps) {
  const root = useRef<HTMLDivElement>(null), eye = useRef<HTMLDivElement>(null), plane = useRef<HTMLDivElement>(null), space = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const engine = useRef<{ update(): void; resetInspect(): void; viewFromEye(): void; refresh(): void } | null>(null);
  const inspectMode = useRef<'overview' | 'eye' | 'free'>('overview');
  const ghostVisible = useRef(true);
  const [atEye, setAtEye] = useState(false), [showGhost, setShowGhost] = useState(true);
  const [error, setError] = useState(''), [restart, setRestart] = useState(0);

  useEffect(() => {
    if (!props.model) return;
    const host = root.current!, eyeElement = eye.current!, planeElement = plane.current!, spaceElement = space.current!;
    let renderer: THREE.WebGLRenderer | undefined;
    let rig: AnamorphRig;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); configureAnamorphRenderer(renderer);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      rig = new AnamorphRig(props.model, current.current.params, renderer);
    } catch (error) {
      renderer?.dispose(); renderer?.forceContextLoss();
      const message = `三维画面暂时无法显示：${(error as Error).message}`; setError(message); current.current.onError?.(message); return;
    }
    const liveRenderer = renderer;
    setError('');
    const canvas = liveRenderer.domElement; canvas.className = 'anamorph-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
    // The source stays square; only this viewing camera expands its horizontal field for the card.
    const displayEye = new THREE.PerspectiveCamera();
    const inspect = new THREE.PerspectiveCamera(40, 2, .01, 300);
    const controls = new OrbitControls(inspect, spaceElement); controls.enableDamping = false; controls.minDistance = 2; controls.maxDistance = 90;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    let frame = 0, disposed = false;
    const fitEyeAspect = (camera: THREE.PerspectiveCamera, aspect: number) => {
      camera.aspect = aspect; camera.fov = rig.eyeCamera.fov;
      if (aspect < 1) camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / aspect));
      camera.updateProjectionMatrix();
    };
    const alignInspect = () => {
      // Coincidence requires the eye's position, not just the same viewing direction.
      inspect.copy(rig.eyeCamera);
      fitEyeAspect(inspect, spaceElement.clientWidth / Math.max(1, spaceElement.clientHeight));
      controls.target.fromArray(MODEL_CENTER); controls.update();
    };
    const fitInspect = () => {
      const box = rig.spaceBounds(), center = box.getCenter(new THREE.Vector3());
      const angle = THREE.MathUtils.degToRad(current.current.params.azimuthDeg);
      // A side view separates the eye from its ray intersections, unlike looking along the eye direction.
      const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const direction = new THREE.Vector3(outward.z, .48, -outward.x).addScaledVector(outward, .16).normalize();
      inspect.fov = 40; inspect.far = 300;
      inspect.up.set(0, 1, 0); inspect.position.copy(center).add(direction); inspect.lookAt(center);
      const aspect = Math.max(.5, spaceElement.clientWidth / Math.max(1, spaceElement.clientHeight));
      inspect.aspect = aspect; inspect.updateProjectionMatrix(); inspect.updateMatrixWorld(true);
      const inverse = new THREE.Matrix4().copy(inspect.matrixWorld).invert();
      const verticalTan = Math.tan(THREE.MathUtils.degToRad(inspect.fov / 2)), horizontalTan = verticalTan * aspect;
      let distance = 4;
      for (const point of rig.spaceFramingPoints()) {
        const p = point.applyMatrix4(inverse);
        distance = Math.max(distance, Math.abs(p.x) / horizontalTan + p.z + 1, Math.abs(p.y) / verticalTan + p.z + 1);
      }
      inspect.position.copy(center).addScaledVector(direction, distance * 1.06);
      controls.target.copy(center); inspect.lookAt(center); controls.update();
    };
    function requestRender() { if (!disposed && !frame) frame = requestAnimationFrame(render); }
    function render() {
      frame = 0; if (disposed) return;
      const hostRect = host.getBoundingClientRect(); if (hostRect.width < 1 || hostRect.height < 1) return;
      const width = Math.round(hostRect.width), height = Math.round(hostRect.height);
      const old = liveRenderer.getSize(new THREE.Vector2()); if (old.x !== width || old.y !== height) liveRenderer.setSize(width, height, false);
      liveRenderer.setRenderTarget(null); liveRenderer.setScissorTest(false); liveRenderer.setViewport(0, 0, width, height); liveRenderer.setClearColor(0x000000, 0); liveRenderer.clear(true, true, true);
      liveRenderer.setScissorTest(true);
      for (const [element, scene, camera] of [[eyeElement, rig.planeScene, displayEye], [planeElement, rig.planeScene, rig.planeCamera], [spaceElement, rig.spaceScene, inspect]] as const) {
        const rect = element.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) continue;
        if (camera === displayEye) {
          displayEye.copy(rig.eyeCamera); fitEyeAspect(displayEye, rect.width / rect.height);
        }
        if (camera === inspect) {
          if (inspectMode.current === 'eye') fitEyeAspect(inspect, rect.width / rect.height);
          else { inspect.aspect = rect.width / rect.height; inspect.updateProjectionMatrix(); }
          rig.configureSpaceView(inspect, ghostVisible.current, inspectMode.current === 'eye');
        }
        if (camera === rig.planeCamera) rig.configurePlaneCamera(rect.width / rect.height);
        liveRenderer.setViewport(rect.left - hostRect.left, hostRect.bottom - rect.bottom, rect.width, rect.height);
        liveRenderer.setScissor(rect.left - hostRect.left, hostRect.bottom - rect.bottom, rect.width, rect.height);
        liveRenderer.clear(true, true, true); liveRenderer.render(scene, camera);
      }
    }
    function update() {
      try {
        rig.update(current.current.params); rig.bake(liveRenderer); setError('');
        if (inspectMode.current === 'eye') alignInspect();
        else if (inspectMode.current === 'overview') fitInspect();
        requestRender();
      } catch (error) { const message = `投影生成失败：${(error as Error).message}`; setError(message); current.current.onError?.(message); }
    }
    const orbitStart = () => { inspectMode.current = 'free'; setAtEye(false); requestRender(); };
    const contextLost = (event: Event) => { event.preventDefault(); setError('三维画面已暂停，请重试。'); };
    controls.addEventListener('start', orbitStart); controls.addEventListener('change', requestRender);
    const observer = new ResizeObserver(() => {
      if (inspectMode.current === 'eye') alignInspect();
      else if (inspectMode.current === 'overview') fitInspect();
      requestRender();
    }); observer.observe(host); [eyeElement, planeElement, spaceElement].forEach(element => observer.observe(element));
    window.addEventListener('resize', requestRender); window.addEventListener('scroll', requestRender, true); canvas.addEventListener('webglcontextlost', contextLost);
    engine.current = {
      update, refresh: requestRender,
      resetInspect() { inspectMode.current = 'overview'; setAtEye(false); fitInspect(); requestRender(); },
      viewFromEye() { inspectMode.current = 'eye'; setAtEye(true); alignInspect(); requestRender(); },
    };
    current.current.onReady?.({
      exportPng: (maxSize = 2048) => exportAnamorphPng(current.current.model!, current.current.params, maxSize),
      resetInspect() { engine.current?.resetInspect(); },
    });
    update();
    return () => {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); controls.removeEventListener('start', orbitStart); controls.removeEventListener('change', requestRender); controls.dispose();
      window.removeEventListener('resize', requestRender); window.removeEventListener('scroll', requestRender, true); canvas.removeEventListener('webglcontextlost', contextLost);
      rig.dispose(); liveRenderer.dispose(); liveRenderer.forceContextLoss(); canvas.remove(); engine.current = null;
    };
  }, [props.model, restart]);

  useEffect(() => { engine.current?.update(); }, [props.params]);

  return <div ref={root} className="anamorph-viewport">
    <div className="anamorph-view-pair">
      <section className="anamorph-view-card"><header><span>指定视点效果</span><small>从设定眼位看平面图</small></header><div className="anamorph-square checkerboard" ref={eye} data-testid="anamorph-eye" role="img" aria-label="指定视点观看平面变形图后的还原效果" /></section>
      <section className="anamorph-view-card"><header><span>平面变形图</span><small>实际导出的图像</small></header><div className="anamorph-square checkerboard" ref={plane} data-testid="anamorph-plane" role="img" aria-label="水平画面上的反透视变形图" /></section>
    </div>
    <section className="anamorph-view-card anamorph-space-card">
      <header><span>空间关系</span><div className="anamorph-space-actions">
        <label><input type="checkbox" checked={showGhost} onChange={event => { ghostVisible.current = event.target.checked; setShowGhost(event.target.checked); engine.current?.refresh(); }} />显示虚像</label>
        <button onClick={() => engine.current?.viewFromEye()} aria-pressed={atEye}>从指定视点看</button>
        <button onClick={() => engine.current?.resetInspect()} aria-label="重置空间视角">空间总览</button>
      </div></header>
      <div className="anamorph-space" ref={space} data-testid="anamorph-space" tabIndex={0} role="group" aria-label="拖动观察指定视点、目标模型与平面投影的空间关系" />
      <footer><span>{atEye ? '已到指定眼位：开关虚像可检查重合，拖动可离开。' : '拖动旋转，滚轮缩放；点击「从指定视点看」验证重合。'}</span><span>只有在指定眼位，平面图才还原目标形状。</span></footer>
    </section>
    {error && <div className="anamorph-error" role="alert"><p>{error}</p><button onClick={() => setRestart(value => value + 1)}>重试三维渲染</button></div>}
    {!props.model && !error && <div className="anamorph-loading">正在准备模型…</div>}
  </div>;
}
