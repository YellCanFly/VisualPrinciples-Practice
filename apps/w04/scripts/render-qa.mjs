import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const warnings = [];
page.on('pageerror', error => warnings.push(error.message));
page.on('console', message => { if (message.type() === 'error') warnings.push(message.text()); });
// Isolate renderer QA from UI HMR while authoring; no production resource is replaced.
await page.route('**/src/main.tsx', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await mkdir('docs/screenshots', { recursive: true });
for (const [name, preset, t, space] of [
  ['render-d09', 'd09-full', null, true],
  ['render-d10-front', 'd10-contact', null, false],
  ['render-d10-shift', 'd10-contact', 1, false],
  ['render-d12-start', 'd12-dolly-zoom', 0, false],
  ['render-d12-end', 'd12-dolly-zoom', 1, false],
]) {
  const image = await page.evaluate(async ({ preset, t, space }) => {
    const { loadPreset, sampleAnimation } = await import('/src/core.ts');
    const { captureExperiment } = await import('/src/engine.ts');
    const state = loadPreset(preset);
    return captureExperiment(t === null ? state : sampleAnimation(state, t), true, space, '', 'free');
  }, { preset, t, space });
  await writeFile(`docs/screenshots/${name}.png`, Buffer.from(image.split(',')[1], 'base64'));
  console.log(`${name}: saved`);
}
console.log('Browser diagnostics:', JSON.stringify(warnings));
await browser.close();
