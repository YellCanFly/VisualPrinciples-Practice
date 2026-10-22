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

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function currentParams(page: Page): Promise<AnamorphParams> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.endsWith(':anamorph:state:v1'));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

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
  await settle(page);
}

/** The oracle renders the actual cube directly. It does not import AnamorphRig or the plane shader. */
async function compareSpace(page: Page, state: string, checkGhost = false) {
  const space = page.getByTestId('anamorph-space');
  await page.getByRole('checkbox', { name: '显示虚像', exact: true }).uncheck();
  await settle(page);
  const rect = (await space.boundingBox())!;
  const plain = await space.screenshot({ scale: 'css' });
  let ghost: Buffer | undefined;
  if (checkGhost) {
    await page.getByRole('checkbox', { name: '显示虚像', exact: true }).check();
    await settle(page);
    ghost = await space.screenshot({ scale: 'css' });
  }
  const params = await currentParams(page);
  const metrics = await page.evaluate(async ({ actual, ghost, params, aspect }) => {
    const decode = async (url: string) => {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, pixels: ctx.getImageData(0, 0, img.width, img.height).data };
    };
    const shown = await decode(`data:image/png;base64,${actual}`);
    const reference = await decode((window as unknown as { AnamorphReference: { renderBox(params: AnamorphParams, width: number, height: number, aspect: number): string } }).AnamorphReference.renderBox(params, shown.width, shown.height, aspect));
    const overlay = ghost ? await decode(`data:image/png;base64,${ghost}`) : null;
    const { width, height } = reference;
    const colorCounts = new Map<string, number>();
    for (let i = 0; i < reference.pixels.length; i += 4) if (reference.pixels[i + 3] > 250) {
      const key = `${reference.pixels[i]},${reference.pixels[i + 1]},${reference.pixels[i + 2]}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }
    const faceColors: number[][] = [];
    for (const [key, count] of [...colorCounts].sort((a, b) => b[1] - a[1])) {
      if (count < 32 || faceColors.length === 3) break;
      const color = key.split(',').map(Number);
      if (!faceColors.some(existing => existing.every((value, channel) => Math.abs(value - color[channel]) < 12))) faceColors.push(color);
    }
    let interior = 0, mismatched = 0, absoluteError = 0, missing = 0;
    let modelIntersection = 0, modelUnion = 0, ghostChanged = 0, ghostOutside = 0;
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const offset = (y * width + x) * 4;
      const solid = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => reference.pixels[((y + dy) * width + x + dx) * 4 + 3] > 250));
      if (solid) {
        let largestError = 0;
        for (let channel = 0; channel < 3; channel++) {
          const delta = Math.abs(reference.pixels[offset + channel] - shown.pixels[offset + channel]);
          absoluteError += delta; largestError = Math.max(largestError, delta);
        }
        interior++;
        if (largestError > 14) mismatched++;
        if (Math.max(shown.pixels[offset], shown.pixels[offset + 1], shown.pixels[offset + 2]) < 80) missing++;
      }
      // Classify by the independently rendered face palette, avoiding the differently colored grid.
      const actualModel = faceColors.some(color => color.every((value, channel) => Math.abs(value - shown.pixels[offset + channel]) < 8));
      const expectedModel = reference.pixels[offset + 3] > 128;
      if (actualModel || expectedModel) modelUnion++;
      if (actualModel && expectedModel) modelIntersection++;
      if (overlay && [0, 1, 2].some(channel => Math.abs(overlay.pixels[offset + channel] - shown.pixels[offset + channel]) > 2)) {
        ghostChanged++;
        // A correctly aligned translucent model cannot add pixels outside its projected silhouette.
        const nearModel = [-2, -1, 0, 1, 2].some(dy => [-2, -1, 0, 1, 2].some(dx => reference.pixels[((y + dy) * width + x + dx) * 4 + 3] > 0));
        if (!nearModel) ghostOutside++;
      }
    }
    return { width, height, faceColors, interior, mismatchFraction: mismatched / interior, meanChannelError: absoluteError / (interior * 3), missingFraction: missing / interior, silhouetteIoU: modelIntersection / modelUnion, ghostChanged, ghostOutsideFraction: ghostChanged ? ghostOutside / ghostChanged : 0 };
  }, { actual: plain.toString('base64'), ghost: ghost?.toString('base64'), params, aspect: rect.width / rect.height });
  console.log(`Spatial eye alignment ${state}: ${JSON.stringify(metrics)}`);
  expect(metrics.interior).toBeGreaterThan(1000);
  expect(metrics.missingFraction, `${state}: every original face is visible in the plane`).toBeLessThan(.005);
  expect(metrics.mismatchFraction, `${state}: plane has the original face colors`).toBeLessThan(.025);
  expect(metrics.meanChannelError, `${state}: plane/direct model RGB agreement`).toBeLessThan(3);
  expect(metrics.silhouetteIoU, `${state}: spatial camera reproduces original shape and size`).toBeGreaterThan(.97);
  if (checkGhost) {
    expect(metrics.ghostChanged, `${state}: the ghost toggle actually changes the rendered view`).toBeGreaterThan(500);
    expect(metrics.ghostOutsideFraction, `${state}: virtual model stays inside the coincident silhouette`).toBeLessThan(.003);
  }
}

test.describe('spatial view at the designated eye', () => {
  test.use({ deviceScaleFactor: 1.5, viewport: { width: 1440, height: 1000 } });
  test('plane and ghost coincide; eye tracking survives edits, resize, model replacement and orbit return', async ({ page }) => {
    test.setTimeout(75_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: '反透视生成', exact: true }).click();
    await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
    await page.addScriptTag({ content: referenceBundle });
    const snap = page.getByRole('button', { name: '从指定视点看', exact: true });
    await snap.click();
    await expect(snap).toHaveAttribute('aria-pressed', 'true');
    await compareSpace(page, 'default', true);

    await patch(page, { azimuthDeg: -115, elevationDeg: 15, distanceM: 5, rotationDeg: 37 });
    await expect(snap).toHaveAttribute('aria-pressed', 'true');
    await compareSpace(page, 'low close oblique eye', true);

    await patch(page, { azimuthDeg: 150, elevationDeg: 75, distanceM: 12, rotationDeg: -45 });
    await compareSpace(page, 'high distant eye');
    await page.setViewportSize({ width: 390, height: 900 });
    await settle(page);
    await compareSpace(page, 'mobile aspect');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await patch(page, { azimuthDeg: 19, elevationDeg: 35, distanceM: 6.5, rotationDeg: 10 });
    const before = await currentParams(page);
    const space = page.getByTestId('anamorph-space');
    await space.scrollIntoViewIfNeeded();
    const box = (await space.boundingBox())!;
    const aligned = await space.screenshot({ scale: 'css' });
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .65, { steps: 10 }); await page.mouse.up();
    await expect(snap).toHaveAttribute('aria-pressed', 'false');
    expect(await space.screenshot({ scale: 'css' })).not.toEqual(aligned);
    expect(await currentParams(page)).toEqual(before);
    await snap.click();
    await compareSpace(page, 'return after free orbit', true);

    // Rebuilding the rendering rig for another model must retain the chosen observation mode.
    for (const modelId of ['teapot', 'box']) {
      await page.getByRole('combobox', { name: '内置模型', exact: true }).selectOption(modelId);
      await expect.poll(async () => (await currentParams(page)).modelId).toBe(modelId);
      await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
      await expect(snap).toHaveAttribute('aria-pressed', 'true');
    }
    await compareSpace(page, 'model replacement', true);
    await mkdir(resolve('docs/screenshots'), { recursive: true });
    await page.screenshot({ path: resolve('docs/screenshots/anamorph-space-eye-aligned.png'), fullPage: true, scale: 'css' });
    await page.getByRole('button', { name: '重置空间视角', exact: true }).click();
    await expect(snap).toHaveAttribute('aria-pressed', 'false');
    expect(await currentParams(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
});
