import { test, expect, type Locator, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AnamorphParams } from '../../src/anamorph-core';

let referenceBundle = '';
test.beforeAll(async () => {
  const built = await build({ entryPoints: [resolve('tests/browser/direct-model-reference.ts')], bundle: true, write: false, format: 'iife', globalName: 'AnamorphReference', platform: 'browser' });
  referenceBundle = built.outputFiles[0].text;
});

async function setRange(locator: Locator, value: number) {
  await locator.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await locator.dispatchEvent('pointerup');
}

async function patch(page: Page, values: Partial<AnamorphParams>) {
  const labels = { rotationDeg: '模型转向', azimuthDeg: '视点方向', elevationDeg: '视点俯角', distanceM: '观察距离' };
  for (const [key, value] of Object.entries(values)) await setRange(page.getByRole('slider', { name: labels[key as keyof typeof labels], exact: true }), value as number);
  await expect.poll(() => currentParams(page)).toMatchObject(values);
  // Wait for React's update and the live renderer's queued frame, not a new rig.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function currentParams(page: Page): Promise<AnamorphParams> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.endsWith(':anamorph:state:v1'));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

async function compareWithDirectModel(page: Page, state: string) {
  const eye = page.getByTestId('anamorph-eye');
  const rect = (await eye.boundingBox())!;
  const screenshot = await eye.screenshot({ scale: 'css' });
  const params = await currentParams(page);
  const metrics = await page.evaluate(async ({ actual, params, aspect }) => {
    const decode = async (url: string) => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, pixels: ctx.getImageData(0, 0, img.width, img.height).data };
    };
    const shown = await decode(`data:image/png;base64,${actual}`);
    const reference = await decode((window as unknown as { AnamorphReference: { renderBox(params: AnamorphParams, width: number, height: number, aspect: number): string } }).AnamorphReference.renderBox(params, shown.width, shown.height, aspect));
    let interior = 0, mismatched = 0, absoluteError = 0, missing = 0;
    const { width, height } = reference;
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      // Exclude only the 2px silhouette/AA boundary. All three cube faces remain compared.
      const solid = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => reference.pixels[((y + dy) * width + x + dx) * 4 + 3] > 250));
      if (!solid) continue;
      const offset = (y * width + x) * 4;
      let largestError = 0;
      for (let channel = 0; channel < 3; channel++) {
        const delta = Math.abs(reference.pixels[offset + channel] - shown.pixels[offset + channel]);
        absoluteError += delta; largestError = Math.max(largestError, delta);
      }
      interior++;
      if (largestError > 14) mismatched++;
      if (Math.max(shown.pixels[offset], shown.pixels[offset + 1], shown.pixels[offset + 2]) < 80) missing++;
    }
    return { width, height, interior, mismatchFraction: mismatched / interior, meanChannelError: absoluteError / (interior * 3), missingFraction: missing / interior };
  }, { actual: screenshot.toString('base64'), params, aspect: rect.width / rect.height });
  console.log(`Direct-model comparison ${state} dpr=${await page.evaluate(() => devicePixelRatio)}: ${JSON.stringify(metrics)}`);
  expect(metrics.interior).toBeGreaterThan(1000);
  expect(metrics.missingFraction, `${state}: no missing visible face`).toBeLessThan(.005);
  expect(metrics.mismatchFraction, `${state}: source/plane face colors`).toBeLessThan(.025);
  expect(metrics.meanChannelError, `${state}: RGB agreement with direct source`).toBeLessThan(3);
}

for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
  test.describe(`anamorph rendering at DPR ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor, viewport: { width: 1440, height: 900 } });
    test('restored plane matches the direct model after parameter, orbit, and resize sequences', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: '反透视生成', exact: true }).click();
      await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
      await page.addScriptTag({ content: referenceBundle });
      await patch(page, { rotationDeg: 10, azimuthDeg: 19, elevationDeg: 35, distanceM: 6.5 });
      await compareWithDirectModel(page, 'reported parameters');
      await mkdir(resolve('docs/screenshots'), { recursive: true });
      await page.screenshot({ path: resolve('docs/screenshots', `anamorph-dpr-${deviceScaleFactor}-reported.png`), fullPage: true, scale: 'css' });
      for (const azimuthDeg of [21, 35, 68, -22]) await patch(page, { azimuthDeg });
      await patch(page, { elevationDeg: 40, distanceM: 5.8, rotationDeg: -28 });
      await compareWithDirectModel(page, 'continuous edits');
      const box = (await page.getByTestId('anamorph-space').boundingBox())!;
      await page.mouse.move(box.x + box.width * .45, box.y + box.height * .45);
      await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .65, { steps: 10 }); await page.mouse.up();
      await patch(page, { rotationDeg: 10, azimuthDeg: 19, elevationDeg: 35, distanceM: 6.5 });
      await compareWithDirectModel(page, 'orbit then edit');
      await page.setViewportSize({ width: 851, height: 1000 });
      await patch(page, { azimuthDeg: -40, elevationDeg: 22, distanceM: 7.4, rotationDeg: 70 });
      await compareWithDirectModel(page, 'resize then edit');
    });
  });
}
