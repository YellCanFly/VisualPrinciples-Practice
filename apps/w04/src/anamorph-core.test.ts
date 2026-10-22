import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { Box3, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import {
  ANAMORPH_DEFAULTS, MODEL_CENTER, MODEL_OPTIONS, exportDimensions, eyePosition,
  fittedFov, modelPointToWorld, planeBounds, projectToPlane, validateAnamorphParams,
  type AnamorphVec3, type BuiltinModelId,
} from './anamorph-core';
import { MAX_FBX_BYTES, disposeModel, importFbx, loadBuiltinModel, modelVertices } from './anamorph-models';

const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z] as AnamorphVec3)));
function cameraFor(eye: AnamorphVec3, distance: number) {
  const camera = new PerspectiveCamera(fittedFov(distance), 1, .05, 300);
  camera.position.set(...eye); camera.lookAt(...MODEL_CENTER); camera.updateMatrixWorld(true);
  return camera;
}
function expectNormalized(model: Group) {
  const bounds = new Box3().setFromObject(model), size = bounds.getSize(new Vector3());
  expect(bounds.getCenter(new Vector3()).length()).toBeLessThan(1e-5);
  expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(2, 5);
  expect(modelVertices(model).every(point => point.every(Number.isFinite))).toBe(true);
  expect(model.userData.triangleCount).toBeGreaterThan(0);
}
async function localAsset(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(new URL(path, import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('planar anamorphosis geometry', () => {
  it('preserves the designated-eye image at every supported viewing extreme', () => {
    for (const azimuthDeg of [-180, -90, 0, 35, 180]) for (const elevationDeg of [15, 25, 75]) for (const distanceM of [5, 7, 12]) for (const rotationDeg of [-180, -37, 0, 90, 180]) {
      const params = { ...ANAMORPH_DEFAULTS, azimuthDeg, elevationDeg, distanceM, rotationDeg };
      const eye = eyePosition(params), camera = cameraFor(eye, distanceM);
      for (const corner of corners) {
        const point = modelPointToWorld(corner, rotationDeg), flat = projectToPlane(point, eye);
        expect(eye[1]).toBeGreaterThan(point[1]);
        expect(flat[1]).toBe(0);
        expect(flat.every(Number.isFinite)).toBe(true);
        const before = new Vector3(...point).project(camera), after = new Vector3(...flat).project(camera);
        expect(Math.abs(before.x - after.x)).toBeLessThan(1e-11);
        expect(Math.abs(before.y - after.y)).toBeLessThan(1e-11);
        expect(Math.abs(before.x)).toBeLessThan(1);
        expect(Math.abs(before.y)).toBeLessThan(1);
      }
    }
  });

  it('encloses the complete flat artwork and exports pixels in physical proportion', () => {
    const eye = eyePosition({ ...ANAMORPH_DEFAULTS, elevationDeg: 15, distanceM: 5 });
    const world = corners.map(point => modelPointToWorld(point, 47));
    const bounds = planeBounds(world, eye);
    for (const point of world.map(point => projectToPlane(point, eye))) {
      expect(point[0]).toBeGreaterThan(bounds.minX); expect(point[0]).toBeLessThan(bounds.maxX);
      expect(point[2]).toBeGreaterThan(bounds.minZ); expect(point[2]).toBeLessThan(bounds.maxZ);
    }
    for (const longEdge of [256, 1024, 2048, 4096]) {
      const pixels = exportDimensions(bounds, longEdge);
      expect(Math.max(pixels.width, pixels.height)).toBe(longEdge);
      const expectedShort = Math.min(bounds.width, bounds.height) / Math.max(bounds.width, bounds.height) * longEdge;
      expect(Math.abs(Math.min(pixels.width, pixels.height) - expectedShort)).toBeLessThanOrEqual(.5);
    }
  });

  it('rejects invalid configurations and rays that do not meet the drawing plane', () => {
    expect(validateAnamorphParams({ ...ANAMORPH_DEFAULTS, extra: true })).toEqual(ANAMORPH_DEFAULTS);
    for (const patch of [{ elevationDeg: 0 }, { elevationDeg: 90 }, { distanceM: 4 }, { azimuthDeg: Infinity }, { color: 'red' }, { modelId: 'unknown' }]) {
      expect(() => validateAnamorphParams({ ...ANAMORPH_DEFAULTS, ...patch })).toThrow();
    }
    expect(() => projectToPlane([0, 2, 0], [0, 2, 5])).toThrow();
    expect(() => projectToPlane([0, 2, 0], [0, 1, 5])).toThrow();
    expect(() => projectToPlane([NaN, 0, 0], [0, 2, 5])).toThrow();
    expect(() => planeBounds([], [0, 2, 5])).toThrow();
    expect(() => exportDimensions({ width: 0, height: 1 })).toThrow();
    expect(() => fittedFov(1)).toThrow();
  });
});

describe('local teaching model library and FBX import', () => {
  const generated = MODEL_OPTIONS.filter(option => !['bunny', 'monkey'].includes(option.id));
  it.each(generated)('normalizes the $label mesh without external resources', async ({ id }) => {
    const model = await loadBuiltinModel(id);
    try { expectNormalized(model); } finally { disposeModel(model); }
  });

  it.each([
    { id: 'bunny', file: 'stanford-bunny.ply', vertices: 15258, triangles: 30338 },
    { id: 'monkey', file: 'suzanne.ply', vertices: 2012, triangles: 3936 },
  ])('loads the real packaged $id mesh and keeps it upright', async ({ id, file, vertices, triangles }) => {
    const bytes = await localAsset(`../public/models/${file}`);
    const geometry = new PLYLoader().parse(bytes);
    expect(geometry.getAttribute('position').count).toBe(vertices);
    expect(geometry.index!.count / 3).toBe(triangles);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new Vector3());
    expect(size.y).toBeGreaterThan(size.z);
    geometry.dispose();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes }));
    try {
      const model = await loadBuiltinModel(id as BuiltinModelId);
      try { expectNormalized(model); expect(model.userData.triangleCount).toBe(triangles); }
      finally { disposeModel(model); }
    } finally { vi.unstubAllGlobals(); }
  });

  it('parses the real FBX fixture, bakes transforms, and preserves a normalized static mesh', async () => {
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 1024 });
    try {
      const model = await importFbx(await localAsset('../tests/fixtures/stanford-bunny.fbx'), 'bunny.fbx');
      try {
        expectNormalized(model);
        expect(model.userData.sourceFile).toBe('bunny.fbx');
        expect(model.userData.triangleCount).toBe(30338);
        for (const child of model.children as Mesh[]) {
          expect(child.position.length()).toBe(0);
          expect(child.scale.toArray()).toEqual([1, 1, 1]);
          expect(child.geometry.getAttribute('uv')).toBeUndefined();
        }
      } finally { disposeModel(model); }
    } finally { vi.unstubAllGlobals(); }
  });

  it('rejects empty, oversized, and unsupported FBX content', async () => {
    await expect(importFbx(new ArrayBuffer(0))).rejects.toThrow('为空');
    await expect(importFbx(new ArrayBuffer(MAX_FBX_BYTES + 1))).rejects.toThrow('50MB');
    const bytes = new TextEncoder().encode('this is not an FBX');
    await expect(importFbx(bytes.buffer)).rejects.toThrow('无法读取');
  });
});
