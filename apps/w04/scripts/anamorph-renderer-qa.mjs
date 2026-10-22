import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ANAMORPH_QA_URL || 'http://127.0.0.1:4186/');
  await page.getByRole('button', { name: '反透视生成', exact: true }).click();
  await page.getByTestId('anamorph-eye').waitFor();
  await page.waitForTimeout(1300);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/anamorph-renderer-workspace.png', fullPage: true });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { AnamorphRig, configureAnamorphRenderer, exportAnamorphPng } = await import('/src/anamorph-engine.ts');
    const { ANAMORPH_DEFAULTS } = await import('/src/anamorph-core.ts');
    const model = new THREE.Group(); model.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()));
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configureAnamorphRenderer(renderer); renderer.setSize(512, 512);
    const rig = new AnamorphRig(model, ANAMORPH_DEFAULTS, renderer);
    const read = (scene, camera) => {
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, 512, 512); renderer.setScissorTest(false); renderer.clear(true, true, true); renderer.render(scene, camera);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d'); ctx.drawImage(renderer.domElement, 0, 0);
      return { pixels: ctx.getImageData(0, 0, 512, 512).data, image: canvas.toDataURL() };
    };
    const comparisons = [];
    let reference, recovered;
    for (const params of [ANAMORPH_DEFAULTS, { ...ANAMORPH_DEFAULTS, azimuthDeg: -135, elevationDeg: 15, distanceM: 5, rotationDeg: 45 }, { ...ANAMORPH_DEFAULTS, azimuthDeg: 180, elevationDeg: 75, distanceM: 12, rotationDeg: -50 }]) {
      rig.update(params); rig.bake(renderer);
      const source = read(rig.sourceScene, rig.eyeCamera), plane = read(rig.planeScene, rig.eyeCamera);
      if (!reference) { reference = source.image; recovered = plane.image; }
      let count = 0, difference = 0, bad = 0, silhouette = 0;
      for (let i = 0; i < source.pixels.length; i += 4) {
        if (source.pixels[i + 3] > 250 && plane.pixels[i + 3] > 250) {
          const delta = Math.max(...[0, 1, 2].map(c => Math.abs(source.pixels[i + c] - plane.pixels[i + c])));
          count++; difference += delta; if (delta > 12) bad++;
        }
        if (Math.abs(source.pixels[i + 3] - plane.pixels[i + 3]) > 24) silhouette++;
      }
      comparisons.push({ params, opaquePixels: count, meanChannelError: difference / count, inaccurateOpaquePixels: bad, silhouetteDifferentPixels: silhouette });
    }
    rig.dispose(); renderer.dispose(); renderer.forceContextLoss();
    const output = await exportAnamorphPng(model, ANAMORPH_DEFAULTS, 1024);
    const image = new Image(); image.src = output.url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let transparent = 0, opaque = 0, partial = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) transparent++; else if (pixels[i] === 255) opaque++; else partial++;
    model.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
    return { comparisons, reference, recovered, output, alpha: { transparent, opaque, partial } };
  });
  for (const [filename, url] of [['reference', result.reference], ['recovered', result.recovered], ['export', result.output.url]]) await writeFile(`docs/screenshots/anamorph-renderer-${filename}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(JSON.stringify({ errors, comparisons: result.comparisons, dimensions: { width: result.output.width, height: result.output.height }, alpha: result.alpha }, null, 2));
} finally { await browser.close(); }
