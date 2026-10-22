import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  DEFAULT_Q, PRESETS, alignmentFor, cameraAtMapPoint, captureReference, clone, compareSnapshots,
  createDefaultSave, createFigureGeometry, decodeShare, encodeShare, errorMap, getDollyDistanceBounds, loadPreset,
  moveObject, parseExperiment, parseModuleSave, parseSave, projectPoint, resolveCamera, resolveExperiment,
  sampleAnimation, scaleAroundCamera, setD09SizeMode, setD09TargetKind, setD10Geometry,
  setD10Mode, setD10Phase, setDollyDistance, setLensMode, solveAlignedRoot, transformPoint,
  worldAnchor, type CameraInput, type D09State, type D10State, type D12State, type Transform, type Vec3,
} from './core';

const camera: CameraInput = { position: [0, 1.6, 0], yawDeg: 0, pitchDeg: 0, focalMm: 35 };
const getD10 = () => loadPreset('d10-contact') as D10State;
const getD12 = () => loadPreset('d12-dolly-zoom') as D12State;

describe('M01–M10: geometry and persistence acceptance', () => {
  it.each([
    [35, 32.268802, 54.432223], [70, 16.460690, 28.841546],
  ])('M01: fixed 36 × 20.25 mm sensor at %s mm', (focalMm, vertical, horizontal) => {
    const result = resolveCamera({ ...camera, focalMm });
    expect(result.verticalFov).toBeCloseTo(vertical, 4);
    expect(result.horizontalFov).toBeCloseTo(horizontal, 4);
    const three = new PerspectiveCamera(50, 16 / 9, .05, 100);
    three.filmGauge = 36; three.setFocalLength(focalMm);
    expect(three.fov).toBeCloseTo(result.verticalFov, 10);
  });
  it('analytic projection matches the actual Three.js matrix under rotation', () => {
    const input: CameraInput = { position: [.6, 1.9, 2], yawDeg: 12, pitchDeg: -6, focalMm: 53 };
    const resolved = resolveCamera(input);
    const three = new PerspectiveCamera(resolved.verticalFov, 16 / 9, .05, 100);
    three.position.fromArray(input.position); three.quaternion.fromArray(resolved.quaternion); three.updateMatrixWorld(true);
    for (const point of [[-1, 2, -8], [2.4, .3, -15], [0, 3, -6]] as Vec3[]) {
      const analytic = projectPoint(point, input); const actual = new Vector3(...point).project(three);
      expect(analytic.valid).toBe(true);
      if (analytic.valid) { expect(analytic.ndc[0]).toBeCloseTo(actual.x, 12); expect(analytic.ndc[1]).toBeCloseTo(actual.y, 12); }
    }
  });
  it('M02/M03: dolly zoom preserves subject height and changes the background ratio', () => {
    const near = resolveExperiment(getD12());
    const far = resolveExperiment(setDollyDistance(getD12(), 12));
    expect(near.camera.focalMm).toBeCloseTo(35, 10); expect(far.camera.focalMm).toBeCloseTo(70, 10);
    expect(near.measurements[0].projectedHeight).toBeCloseTo(140 / 243, 12);
    expect(far.measurements[0].projectedHeight).toBeCloseTo(140 / 243, 12);
    expect(near.measurements[1].depthM).toBe(14); expect(far.measurements[1].depthM).toBe(20);
    expect(near.backgroundRatio).toBeCloseTo(3 / 7, 12); expect(far.backgroundRatio).toBeCloseTo(.6, 12);
    expect(near.measurements[1].projectedHeight! / near.measurements[0].projectedHeight!).toBeCloseTo(3 / 7, 12);
  });
  it('M04: scaling every vertex around the reference camera preserves NDC', () => {
    const ref: CameraInput = { ...camera, position: [.4, 2, .7], yawDeg: 8, pitchDeg: -3 };
    const base: Transform = { position: [-1, 1, -16], quaternion: [0, Math.sin(.17), 0, Math.cos(.17)], scale: [1.2, 1.5, .9] };
    let seed = 731;
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 80; i++) {
      const vertex: Vec3 = [rand() - .5, rand(), rand() - .5];
      const original = projectPoint(transformPoint(vertex, base), ref);
      expect(original.valid).toBe(true);
      for (const k of [.5, 1, 2]) {
        const result = projectPoint(transformPoint(vertex, scaleAroundCamera(ref, base, k)), ref);
        expect(result.valid).toBe(true);
        if (original.valid && result.valid) { expect(result.ndc[0]).toBeCloseTo(original.ndc[0], 12); expect(result.ndc[1]).toBeCloseTo(original.ndc[1], 12); }
      }
    }
  });
  it('M05: alignment solves actual local contacts with rotation and scale', () => {
    const ref: CameraInput = { ...camera, yawDeg: -11, pitchDeg: 7 };
    const localAnchor: Vec3 = [.2, 1.1, -.1];
    const rotation: Transform['quaternion'] = [0, 0, Math.sin(.1), Math.cos(.1)];
    const scale: Vec3 = [2, 1.5, .8];
    const position = solveAlignedRoot(ref, [.12, -.3], 17, localAnchor, rotation, scale);
    const point = projectPoint(transformPoint(localAnchor, { position, quaternion: rotation, scale }), ref);
    expect(point.valid).toBe(true);
    if (point.valid) { expect(point.ndc[0]).toBeCloseTo(.12, 12); expect(point.ndc[1]).toBeCloseTo(-.3, 12); }
    expect(resolveExperiment(getD10()).alignment!.errorPx).toBeLessThan(.000001);
  });
  it('M06: a 0.1 m lateral shift produces 20.7407 reference pixels', () => {
    const state = setD10Phase(getD10(), 'observe'); state.camera.position[0] = .1;
    const result = resolveExperiment(state);
    expect(result.alignment!.errorPx).toBeCloseTo(20.7407407407, 8);
    expect(result.alignment!.errorHeightPercent).toBeCloseTo(1.9204389575, 8);
  });
  it('M07: rotating or zooming about one center retains aligned rays; out-of-frame is explicit', () => {
    const state = setD10Phase(getD10(), 'observe'); state.camera.yawDeg = 15; state.camera.pitchDeg = -10; state.camera.focalMm = 100;
    const result = resolveExperiment(state);
    expect(result.alignment!.errorPx).toBeLessThan(1e-8);
    expect(result.alignment!.visible).toBe(false);
    expect(projectPoint([0, 1.6, 1], camera)).toMatchObject({ valid: false, reason: 'behind' });
    expect(projectPoint([0, 1.6, -.01], camera)).toMatchObject({ valid: false, reason: 'near' });
    expect(projectPoint([0, 1.6, -101], camera)).toMatchObject({ valid: false, reason: 'far' });
  });
  it('M08: equal-image compensation changes world height and keeps all planar projections equal', () => {
    let state = loadPreset('d09-equal-image') as D09State;
    state.targets[0].depthM = 3; state.targets[2].depthM = 24;
    const result = resolveExperiment(state);
    expect(result.measurements[0].heightM).toBeCloseTo(.42, 10);
    expect(result.measurements[2].heightM).toBeCloseTo(3.36, 10);
    expect(result.measurements[0].projectedHeight).toBeCloseTo(result.measurements[1].projectedHeight!, 12);
    expect(result.measurements[2].projectedHeight).toBeCloseTo(result.measurements[1].projectedHeight!, 12);
    state = setD09TargetKind(state, 'figure');
    expect(state.sizeMode).toBe('free'); expect(state.targets[2].heightM).toBeCloseTo(3.36, 10);
  });
  it('M09: lens limits clamp distance, never break the locked height', () => {
    const bounds = getDollyDistanceBounds();
    expect(bounds[0]).toBeCloseTo(3.085714285714, 10); expect(bounds[1]).toBeCloseTo(17.142857142857, 10);
    for (const requested of [-1, 3, 6, 12, 18, 99]) {
      const state = setDollyDistance(getD12(), requested); const result = resolveExperiment(state);
      expect(state.rig.distanceM).toBeGreaterThanOrEqual(bounds[0]); expect(state.rig.distanceM).toBeLessThanOrEqual(bounds[1]);
      expect(result.measurements[0].projectedHeight).toBeCloseTo(DEFAULT_Q, 12);
      expect(result.camera.focalMm).toBeGreaterThanOrEqual(18 - 1e-10); expect(result.camera.focalMm).toBeLessThanOrEqual(100 + 1e-10);
    }
  });
  it('M10: every preset round-trips through strict JSON and URL with identical geometry', () => {
    const save = createDefaultSave(); expect(parseSave(JSON.stringify(save))).toEqual(save);
    for (const preset of PRESETS) {
      const state = loadPreset(preset.id); const json = parseExperiment(JSON.stringify(state)); const shared = decodeShare(encodeShare(state));
      expect(json).toEqual(state); expect(shared).toEqual(state);
      expect(resolveExperiment(json)).toEqual(resolveExperiment(state));
      expect(resolveExperiment(shared!)).toEqual(resolveExperiment(state));
    }
  });
  it('current-module saves use a validated versioned wrapper', () => {
    for (const preset of PRESETS) {
      const state = loadPreset(preset.id);
      const save = { schemaVersion: 1, appVersion: '1.0.0', experiment: state };
      expect(parseModuleSave(save)).toEqual(state);
      expect(parseModuleSave(JSON.stringify(save))).toEqual(state);
    }
  });
  it('module save wrappers reject unknown versions, fields and invalid experiment data', () => {
    const save = { schemaVersion: 1, appVersion: '1.0.0', experiment: getD12() };
    expect(() => parseModuleSave({ ...save, schemaVersion: 2 })).toThrow();
    expect(() => parseModuleSave({ ...save, unknown: true })).toThrow();
    expect(() => parseModuleSave({ ...save, experiment: { ...save.experiment, unexpected: 3 } })).toThrow();
    expect(() => parseModuleSave(save.experiment)).toThrow();
    expect(() => parseModuleSave({ ...save, appVersion: 100 })).toThrow();
  });
  it('rejects malformed, nonfinite, unknown, contradictory and oversize states', () => {
    expect(() => parseSave({ ...createDefaultSave(), schemaVersion: 2 })).toThrow();
    expect(() => parseExperiment({ ...getD12(), unknownField: true })).toThrow();
    const bad = getD12(); bad.rig = { mode: 'dollyZoom', distanceM: 18, lockedQ: DEFAULT_Q }; expect(() => parseExperiment(bad)).toThrow();
    const badFloat = getD10(); badFloat.camera.focalMm = Infinity; expect(() => parseExperiment(badFloat)).toThrow();
    const badQ = getD10(); badQ.objects[0].transform.quaternion = [0, 0, 0, 0]; expect(() => parseExperiment(badQ)).toThrow();
    expect(() => parseSave(' '.repeat(256 * 1024 + 1))).toThrow(/256 KB/);
    expect(() => decodeShare('#m=d12&v=2')).toThrow();
    expect(() => decodeShare('#m=d12&v=1&s=broken')).toThrow();
  });
});

describe('interaction constraints and deterministic derived state', () => {
  it('detects a card crossing the horizontal image edge without changing its reference height', () => {
    const state = loadPreset('d09-full') as D09State;
    const original = resolveExperiment(state).measurements[0];
    state.targets[0].x = .48 * 36 * 6 / 35;
    const partial = resolveExperiment(state).measurements[0];
    expect(partial.top.valid && partial.top.inFrame).toBe(true);
    expect(partial.bottom.valid && partial.bottom.inFrame).toBe(true);
    expect(partial.inFrame).toBe(false);
    expect(partial.projectedHeight).toBeCloseTo(original.projectedHeight!, 12);
    state.targets[0].x = 2.5;
    expect(resolveExperiment(state).measurements[0].inFrame).toBe(true);
  });
  it('figure world dimensions and projected envelope use the same physical mesh', () => {
    const state = setD09TargetKind(loadPreset('d09-full') as D09State, 'figure');
    const result = resolveExperiment(state), object = result.objects[0];
    const geometry = createFigureGeometry(object.dimensions); geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(1.4, 6);
    const positions = geometry.getAttribute('position'), verticals: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const p = projectPoint(transformPoint([positions.getX(i), positions.getY(i), positions.getZ(i)], object.transform), result.camera);
      if (p.valid) verticals.push(p.v);
    }
    expect(result.measurements[0].projectedHeight).toBeCloseTo(Math.max(...verticals) - Math.min(...verticals), 12);
    geometry.dispose();
  });
  it('freezes geometry before camera inspection and returns without solver jumps', () => {
    let state = getD10(); state.ndc = [.2, -.1]; state.farDepthM = 20;
    const original = resolveExperiment(state).objects;
    state = setD10Phase(state, 'observe'); state.camera.position[0] = .5;
    expect(resolveExperiment(state).objects).toEqual(original);
    expect(resolveExperiment(state).alignment!.errorPx).toBeGreaterThan(50);
    state = setD10Phase(state, 'edit');
    expect(state.camera).toEqual(state.referenceCamera); expect(state.mode).toBe('free');
    expect(resolveExperiment(state).objects).toEqual(original);
  });
  it('captures a new reference as an atomic no-motion operation', () => {
    let state = setD10Mode(getD10(), 'rayScale'); state.k = 2;
    state.camera.position[0] = .3;
    const objects = resolveExperiment(state).objects;
    const next = captureReference(state);
    expect(next.referenceCamera).toEqual(state.camera); expect(next.k).toBe(1);
    expect(next.mode).toBe('free'); expect(resolveExperiment(next).objects).toEqual(objects);
    expect(next.baselineObjects).toEqual(objects);
  });
  it('ray scale uses the baseline, preserves 36 m derived depth, and exits without a jump', () => {
    let state = loadPreset('d10-ray-scale') as D10State; state.k = 2;
    const objects = resolveExperiment(state).objects;
    const reference = projectPoint(worldAnchor(objects[1], 'contact'), state.referenceCamera);
    expect(reference.depthM).toBeCloseTo(36, 10);
    state = setD10Mode(state, 'free');
    expect(resolveExperiment(state).objects).toEqual(objects); expect(state.farDepthM).toBeCloseTo(36, 10);
    expect(parseExperiment(state)).toEqual(state);
  });
  it('free object controls move actual geometry, while observation prevents mutation', () => {
    const state = setD10Mode(getD10(), 'free');
    const moved = setD10Geometry(state, 'farDepthM', 22);
    expect(projectPoint(worldAnchor(resolveExperiment(moved).objects[1], 'contact'), state.referenceCamera).depthM).toBeCloseTo(22, 10);
    const frozen = setD10Phase(moved, 'observe');
    expect(moveObject(frozen, 'sphere', [4, 1, -10])).toEqual(frozen);
    expect(setD10Geometry(frozen, 'farScale', 2)).toEqual(frozen);
  });
  it('entering the dolly lock preserves the current target size rather than resetting it', () => {
    const state = loadPreset('d12-zoom') as D12State; state.rig = { mode: 'zoom', distanceM: 9, focalMm: 42 };
    const before = resolveExperiment(state); const next = setLensMode(state, 'dollyZoom');
    expect(next.rig.mode).toBe('dollyZoom');
    expect(resolveExperiment(next).measurements[0].projectedHeight).toBeCloseTo(before.measurements[0].projectedHeight!, 12);
    expect(resolveExperiment(setDollyDistance(next, 12)).measurements[0].projectedHeight).toBeCloseTo(before.measurements[0].projectedHeight!, 12);
  });
  it.each(['d09-full', 'd10-contact', 'd12-dolly-zoom'])('seeking %s is deterministic and leaves its baseline unchanged', id => {
    const start = loadPreset(id); const saved = clone(start);
    const a = sampleAnimation(start, .42); sampleAnimation(start, .9); const b = sampleAnimation(start, .42);
    expect(a).toEqual(b); expect(start).toEqual(saved); expect(parseExperiment(a)).toEqual(a);
    if (a.module === 'd12') expect(resolveExperiment(a).measurements[0].projectedHeight).toBeCloseTo(DEFAULT_Q, 12);
  });
  it('441 map points use the saved reference camera and match their selected shot', () => {
    const state = getD10(); state.camera.focalMm = 70; state.camera.yawDeg = 9;
    const cells = errorMap(state); expect(cells).toHaveLength(441);
    expect(cells[220].errorPx).toBeLessThan(1e-9);
    const cell = cells[247]; const selected = cameraAtMapPoint(state, cell.x, cell.y);
    expect(selected.camera.focalMm).toBe(35); expect(selected.camera.yawDeg).toBe(0);
    expect(resolveExperiment(selected).alignment!.errorPx).toBeCloseTo(cell.errorPx!, 10);
  });
  it('same-position zoom cancels focal length in foreground/background ratio', () => {
    const state = loadPreset('d12-zoom') as D12State;
    const a = resolveExperiment(state); state.rig = { mode: 'zoom', distanceM: 6, focalMm: 70 }; const b = resolveExperiment(state);
    expect(a.backgroundRatio).toBe(b.backgroundRatio);
    expect(b.measurements[0].projectedHeight! / a.measurements[0].projectedHeight!).toBeCloseTo(2, 12);
  });
  it('snapshot differences include automatic focal changes', () => {
    const before = getD12(), after = setDollyDistance(before, 12);
    const diff = compareSnapshots(before, after);
    expect(diff.find(d => d.key === 'derived.focalMm')).toMatchObject({ before: '35.000', after: '70.000' });
    expect(diff.find(d => d.key === 'rig.distanceM')).toMatchObject({ before: '6', after: '12' });
    expect(compareSnapshots(before, clone(before))).toEqual([]);
  });
  it('depth-cue toggles preserve all geometry and camera parameters', () => {
    const state = loadPreset('d09-full') as D09State; const before = resolveExperiment(state);
    state.cues.grid = false; state.cues.shadows = false;
    const after = resolveExperiment(state); expect(after.objects).toEqual(before.objects); expect(after.camera).toEqual(before.camera);
    const free = setD09SizeMode(loadPreset('d09-equal-image') as D09State, 'free');
    expect(free.targets.map(t => t.heightM)).toEqual([.84, 1.4, 2.2399999999999998]);
  });
});
