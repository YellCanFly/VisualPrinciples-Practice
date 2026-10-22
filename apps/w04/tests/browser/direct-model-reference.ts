import * as THREE from 'three';
import { eyePosition, fittedFov, MODEL_CENTER, type AnamorphParams } from '../../src/anamorph-core';

/** Independent reference: renders the original cube directly, without a plane or render target. */
export function renderBox(params: AnamorphParams, width: number, height: number, aspect: number): string {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({ color: params.color, roughness: .58, metalness: .03, side: THREE.DoubleSide });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.fromArray(MODEL_CENTER);
  cube.rotation.y = THREE.MathUtils.degToRad(params.rotationDeg);
  scene.add(cube, new THREE.HemisphereLight('#f4f9ff', '#617478', 1.8));
  const key = new THREE.DirectionalLight('#fff1d7', 2.6); key.position.set(-3, 7, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#b8d9ff', .6); fill.position.set(5, 2, -3); scene.add(fill);
  let fov = fittedFov(params.distanceM);
  if (aspect < 1) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) / aspect));
  const camera = new THREE.PerspectiveCamera(fov, aspect, .01, 200);
  camera.position.fromArray(eyePosition(params));
  camera.lookAt(...MODEL_CENTER);
  try {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    geometry.dispose(); material.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss();
  }
}
