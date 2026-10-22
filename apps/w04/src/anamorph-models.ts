import {
  Box3, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, IcosahedronGeometry, LoadingManager, Matrix3,
  Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, TetrahedronGeometry,
  TorusGeometry, TorusKnotGeometry, Vector3, type Material, type Texture,
} from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { type AnamorphVec3, type BuiltinModelId, MODEL_OPTIONS } from './anamorph-core';

export const MAX_FBX_BYTES = 50 * 1024 * 1024;
export const MAX_TRIANGLES = 250_000;
const EMPTY_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const material = () => new MeshStandardMaterial({ color: '#78b9ce', roughness: .58, metalness: .02, side: DoubleSide });

function geometries(root: Group): BufferGeometry[] {
  const result: BufferGeometry[] = [];
  root.traverse(child => { if ((child as Mesh).isMesh) result.push((child as Mesh).geometry); });
  return result;
}

/** Returned Group is centered at local origin, maximum extent 2. No Y translation or yaw is applied. */
export function normalizeModel(root: Group): Group {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (![...size.toArray(), ...center.toArray()].every(Number.isFinite) || largest < 1e-8) throw new Error('模型没有有效的几何范围');
  for (const geometry of geometries(root)) {
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(2 / largest, 2 / largest, 2 / largest);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  root.userData.normalized = true;
  return root;
}

/** Bakes the loaded static pose/world transforms; external materials and textures are discarded. */
function freezeModel(source: Group, label: string): Group {
  source.updateMatrixWorld(true);
  source.traverse(child => { const skinned = child as Mesh & { skeleton?: { update(): void } }; skinned.skeleton?.update(); });
  const root = new Group(); root.name = label;
  let triangles = 0;
  try {
    source.traverse(child => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')) return;
      const positions = mesh.geometry.getAttribute('position');
      triangles += (mesh.geometry.index?.count ?? positions.count) / 3;
      if (triangles > MAX_TRIANGLES || positions.count > MAX_TRIANGLES * 3) throw new Error('模型过于复杂，请将三角面数减少到 25 万以内');
      if (positions.count < 3) return;
      const geometry = new BufferGeometry(), array = new Float32Array(positions.count * 3), point = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        mesh.getVertexPosition(i, point); point.applyMatrix4(mesh.matrixWorld);
        if (!point.toArray().every(Number.isFinite)) throw new Error('模型包含无效的顶点坐标');
        point.toArray(array, i * 3);
      }
      geometry.setAttribute('position', new Float32BufferAttribute(array, 3));
      if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
      const originalNormal = mesh.geometry.getAttribute('normal');
      if (originalNormal) {
        const normals = new Float32Array(originalNormal.count * 3), normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
        for (let i = 0; i < originalNormal.count; i++) point.fromBufferAttribute(originalNormal, i).applyNormalMatrix(normalMatrix).toArray(normals, i * 3);
        geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      } else geometry.computeVertexNormals();
      root.add(new Mesh(geometry, material()));
    });
    if (!root.children.length || triangles < 1) throw new Error('文件中没有可显示的三角网格');
    root.userData.triangleCount = Math.round(triangles);
    return normalizeModel(root);
  } catch (error) { disposeModel(root); throw error; }
}

export function modelVertices(root: Group): AnamorphVec3[] {
  root.updateMatrixWorld(true);
  const points: AnamorphVec3[] = [], point = new Vector3();
  root.traverse(child => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) points.push(point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).toArray() as AnamorphVec3);
  });
  return points;
}

export async function loadBuiltinModel(id: BuiltinModelId): Promise<Group> {
  const label = MODEL_OPTIONS.find(option => option.id === id)?.label;
  if (!label) throw new Error('未知的内置模型');
  let geometry: BufferGeometry;
  switch (id) {
    case 'box': geometry = new BoxGeometry(2, 2, 2); break;
    case 'sphere': geometry = new SphereGeometry(1, 48, 32); break;
    case 'cylinder': geometry = new CylinderGeometry(.8, .8, 2, 48); break;
    case 'cone': geometry = new ConeGeometry(1, 2, 48); break;
    case 'torus': geometry = new TorusGeometry(.75, .25, 24, 64); break;
    case 'torusKnot': geometry = new TorusKnotGeometry(.65, .24, 96, 16); break;
    case 'tetrahedron': geometry = new TetrahedronGeometry(1); break;
    case 'octahedron': geometry = new OctahedronGeometry(1); break;
    case 'icosahedron': geometry = new IcosahedronGeometry(1); break;
    case 'teapot': geometry = new TeapotGeometry(1, 12, true, true, true, true, true); break;
    default: {
      const filename = id === 'bunny' ? 'stanford-bunny.ply' : 'suzanne.ply';
      const response = await fetch(`${import.meta.env.BASE_URL}models/${filename}`);
      if (!response.ok) throw new Error(`${label}资源加载失败，请确认本地运行包完整`);
      geometry = new PLYLoader().parse(await response.arrayBuffer());
      // Blender's exported Suzanne faces -Z; present its face toward the default +Z eye.
      if (id === 'monkey') geometry.rotateY(Math.PI);
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      break;
    }
  }
  const source = new Group(); source.add(new Mesh(geometry, material()));
  try { const result = freezeModel(source, label); result.userData.builtinId = id; return result; }
  finally { disposeModel(source); }
}

export async function importFbx(buffer: ArrayBuffer, filename = '导入模型.fbx'): Promise<Group> {
  if (buffer.byteLength > MAX_FBX_BYTES) throw new Error('FBX 文件不能超过 50MB');
  if (!buffer.byteLength) throw new Error('FBX 文件为空');
  const manager = new LoadingManager();
  // Local geometry import never asks a remote server for embedded path names.
  manager.setURLModifier(url => url.startsWith('blob:') || url.startsWith('data:') ? url : EMPTY_PIXEL);
  let source: Group | undefined;
  try {
    source = new FBXLoader(manager).parse(buffer, '');
    const result = freezeModel(source, filename);
    result.userData.sourceFile = filename;
    return result;
  } catch (error) {
    const message = (error as Error).message;
    if (/没有可显示|过于复杂|无效的顶点|几何范围/.test(message)) throw error;
    throw new Error('无法读取此 FBX，请使用 FBX 7.0 以上的 ASCII 或 6400 以上的二进制格式');
  } finally { if (source) disposeModel(source); }
}

export function disposeModel(root: Group): void {
  const seenGeometries = new Set<BufferGeometry>(), seenMaterials = new Set<Material>(), seenTextures = new Set<Texture>();
  root.traverse(child => {
    const mesh = child as Mesh;
    if (mesh.geometry && !seenGeometries.has(mesh.geometry)) { seenGeometries.add(mesh.geometry); mesh.geometry.dispose(); }
    const materials = mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : [];
    for (const mat of materials) if (!seenMaterials.has(mat)) {
      seenMaterials.add(mat);
      for (const value of Object.values(mat)) if (value && typeof value === 'object' && (value as Texture).isTexture && !seenTextures.has(value as Texture)) { seenTextures.add(value as Texture); (value as Texture).dispose(); }
      mat.dispose();
    }
  });
  root.clear();
}
