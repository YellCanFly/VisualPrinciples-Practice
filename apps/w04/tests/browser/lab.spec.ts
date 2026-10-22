import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectPoint, resolveExperiment, worldAnchor, type AppSave } from '../../src/core';
import { eyePosition, exportDimensions, modelPointToWorld, planeBounds, type AnamorphParams } from '../../src/anamorph-core';

const screenshots = resolve('docs/screenshots');

test.beforeAll(async ({ browser }) => {
  console.log(`Verified browser: Chromium ${browser.version()} (${process.platform}, headless SwiftShader)`);
});

async function saved(page: Page): Promise<AppSave> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('stereo-lab:') && key.endsWith(':simple:state:v1'));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.getByRole('button', { name: '深度线索', exact: true })).toBeVisible();
  await expect.poll(async () => (await saved(page))?.schemaVersion).toBe(1);
  await expect(page.locator('canvas').first()).toBeVisible();
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

async function snap(page: Page, filename: string) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: resolve(screenshots, filename), fullPage: true });
}

test('basic D09 controls change the rendered scene, preserve geometry for cues, and save each module', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.getByTestId('inspect-viewport')).toBeHidden();
  await expect(page.locator('.metric-strip,.analysis-panel,.snapshot-bar,.presets,.timeline,input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  const image = await page.getByTestId('shot-viewport').screenshot();
  await setRange(page.getByRole('slider', { name: '离相机多远', exact: true }), 8);
  await expect.poll(async () => (await saved(page)).modules.d09.targets[0].depthM).toBe(8);
  expect(await page.getByTestId('shot-viewport').screenshot()).not.toEqual(image);
  const beforeCue = (await saved(page)).modules.d09;
  const backgroundOn = await page.getByTestId('shot-viewport').screenshot();
  await snap(page, 'cues-d09-background-on.png');
  await page.getByRole('checkbox', { name: '背景透视环境', exact: true }).uncheck();
  await expect.poll(async () => {
    const cues = (await saved(page)).modules.d09.cues;
    return [cues.wall, cues.door];
  }).toEqual([false, false]);
  expect(await page.getByTestId('shot-viewport').screenshot()).not.toEqual(backgroundOn);
  expect((await saved(page)).modules.d09.camera).toEqual(beforeCue.camera);
  expect((await saved(page)).modules.d09.targets).toEqual(beforeCue.targets);
  await snap(page, 'cues-d09-background-off.png');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '背景透视环境', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: '背景透视环境', exact: true }).check();
  await expect.poll(async () => {
    const cues = (await saved(page)).modules.d09.cues;
    return [cues.wall, cues.door];
  }).toEqual([true, true]);
  const groundOn = await page.getByTestId('shot-viewport').screenshot();
  await page.getByRole('checkbox', { name: '地面', exact: true }).uncheck();
  await expect.poll(async () => (await saved(page)).modules.d09.cues.ground).toBe(false);
  expect(await page.getByTestId('shot-viewport').screenshot()).not.toEqual(groundOn);
  expect((await saved(page)).modules.d09.camera).toEqual(beforeCue.camera);
  expect((await saved(page)).modules.d09.targets).toEqual(beforeCue.targets);
  await page.getByRole('checkbox', { name: '地面', exact: true }).check();
  await expect.poll(async () => (await saved(page)).modules.d09.cues.ground).toBe(true);
  expect((await saved(page)).modules.d09.cues).toEqual(beforeCue.cues);
  await page.getByRole('checkbox', { name: '地面网格', exact: true }).uncheck();
  await expect.poll(async () => (await saved(page)).modules.d09.cues.grid).toBe(false);
  const afterCue = (await saved(page)).modules.d09;
  expect(afterCue.camera).toEqual(beforeCue.camera);
  expect(afterCue.targets).toEqual(beforeCue.targets);
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await setRange(page.getByRole('slider', { name: '离相机多远', exact: true }), 13);
  await expect.poll(async () => (await saved(page)).modules.d09.targets[1].depthM).toBe(13);
  await page.getByRole('button', { name: '错位片场', exact: true }).click();
  await page.getByRole('button', { name: '反透视生成', exact: true }).click();
  await page.getByRole('button', { name: '深度线索', exact: true }).click();
  await expect.poll(async () => (await saved(page)).modules.d09.targets.map(target => target.depthM)).toEqual([8, 13, 16]);
  await page.reload();
  await expect.poll(async () => (await saved(page)).modules.d09.targets.map(target => target.depthM)).toEqual([8, 13, 16]);
  await page.getByRole('button', { name: '错位片场', exact: true }).click();
  await setRange(page.getByRole('slider', { name: '移动观察机位', exact: true }), .3);
  await expect.poll(async () => (await saved(page)).modules.d10.camera.position[0]).toBe(.3);
  await page.getByRole('button', { name: '重置当前实验', exact: true }).click();
  await expect.poll(async () => (await saved(page)).modules.d10.camera.position[0]).toBe(0);
  expect((await saved(page)).modules.d09.targets.map(target => target.depthM)).toEqual([8, 13, 16]);
  await expect(page.getByRole('button', { name: '机位与焦距', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '深度线索', exact: true }).click();
  await snap(page, 'simple-d09.png');
  expect(errors).toEqual([]);
});

test('D09 equal-image switch keeps all three projected heights equal as depth changes', async ({ page }) => {
  await ready(page);
  await page.getByRole('checkbox', { name: '画面一样大', exact: true }).check();
  await expect(page.getByRole('slider', { name: '物体高度', exact: true })).toBeDisabled();
  await setRange(page.getByRole('slider', { name: '离相机多远', exact: true }), 16);
  await expect.poll(async () => (await saved(page)).modules.d09.targets[0].depthM).toBe(16);
  const equal = (await saved(page)).modules.d09;
  const heights = resolveExperiment(equal).measurements.map(item => item.projectedHeight!);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1e-10);
  await page.getByRole('checkbox', { name: '画面一样大', exact: true }).uncheck();
  await expect(page.getByRole('slider', { name: '物体高度', exact: true })).toBeEnabled();
  await expect.poll(async () => (await saved(page)).modules.d09.sizeMode).toBe('free');
  expect((await saved(page)).modules.d09.targets[0].heightM).toBeCloseTo(2.24, 10);
});

test('D10 distance preserves projection; lateral observation freezes geometry and returns to the front', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '错位片场', exact: true }).click();
  await expect.poll(async () => (await saved(page)).activeModule).toBe('d10');
  const before = (await saved(page)).modules.d10;
  const first = resolveExperiment(before);
  await snap(page, 'simple-d10-front.png');
  await snap(page, 'cues-d10-lit-18.png');
  for (const distance of [30, 36]) {
    await setRange(page.getByRole('slider', { name: '球体距离', exact: true }), distance);
    await expect.poll(async () => resolveExperiment((await saved(page)).modules.d10).measurements[1].depthM).toBeCloseTo(distance, 6);
    const distant = (await saved(page)).modules.d10;
    const second = resolveExperiment(distant);
    expect(second.objects[1].transform.position).not.toEqual(first.objects[1].transform.position);
    expect(second.measurements[1].inFrame).toBe(true);
    for (const anchor of ['top', 'bottom', 'contact'] as const) {
      const a = projectPoint(worldAnchor(first.objects[1], anchor), before.referenceCamera);
      const b = projectPoint(worldAnchor(second.objects[1], anchor), distant.referenceCamera);
      expect(a.valid && b.valid).toBe(true);
      if (a.valid && b.valid) { expect(a.u).toBeCloseTo(b.u, 10); expect(a.v).toBeCloseTo(b.v, 10); }
    }
  }
  const second = resolveExperiment((await saved(page)).modules.d10);
  await snap(page, 'cues-d10-lit-36.png');
  await setRange(page.getByRole('slider', { name: '移动观察机位', exact: true }), .5);
  await expect.poll(async () => (await saved(page)).modules.d10.camera.position[0]).toBe(.5);
  const shifted = (await saved(page)).modules.d10;
  expect(resolveExperiment(shifted).objects).toEqual(second.objects);
  expect(shifted.referenceCamera).toEqual(before.referenceCamera);
  expect(resolveExperiment(shifted).alignment!.errorPx!).toBeGreaterThan(50);
  await snap(page, 'simple-d10-side.png');
  await page.getByRole('button', { name: '回到正面', exact: true }).click();
  await expect.poll(async () => (await saved(page)).modules.d10.camera).toEqual(before.referenceCamera);
  expect(resolveExperiment((await saved(page)).modules.d10).objects).toEqual(second.objects);
});

async function anamorphSaved(page: Page): Promise<AnamorphParams> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('stereo-lab:') && key.endsWith(':anamorph:state:v1'));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

async function anamorphReady(page: Page) {
  await page.getByRole('button', { name: '反透视生成', exact: true }).click();
  await expect(page.getByTestId('anamorph-eye')).toBeVisible();
  await expect(page.getByTestId('anamorph-plane')).toBeVisible();
  await expect(page.getByTestId('anamorph-space')).toBeVisible();
  await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
  await expect.poll(async () => (await anamorphSaved(page))?.modelId).toBeTruthy();
}

test('anamorph eye parameters change flat image and spatial relation, while orbit remains independent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await anamorphReady(page);
  const image = await page.getByTestId('anamorph-plane').screenshot();
  const relation = await page.getByTestId('anamorph-space').screenshot();
  await setRange(page.getByRole('slider', { name: '视点方向', exact: true }), 60);
  await expect.poll(async () => (await anamorphSaved(page)).azimuthDeg).toBe(60);
  expect(await page.getByTestId('anamorph-plane').screenshot()).not.toEqual(image);
  expect(await page.getByTestId('anamorph-space').screenshot()).not.toEqual(relation);
  await setRange(page.getByRole('slider', { name: '视点俯角', exact: true }), 35);
  await expect.poll(async () => (await anamorphSaved(page)).elevationDeg).toBe(35);
  const beforeOrbit = await anamorphSaved(page);
  const beforeInspect = await page.getByTestId('anamorph-space').screenshot();
  const box = (await page.getByTestId('anamorph-space').boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 100, { steps: 10 });
  await page.mouse.up();
  expect(await page.getByTestId('anamorph-space').screenshot()).not.toEqual(beforeInspect);
  expect(await anamorphSaved(page)).toEqual(beforeOrbit);
  await page.reload();
  await anamorphReady(page);
  await expect(page.getByRole('slider', { name: '视点方向', exact: true })).toHaveValue('60');
  await snap(page, 'anamorph-workspace.png');
});

test('all reference models are local, visible, and can generate the anamorphic image', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await anamorphReady(page);
  const selector = page.getByRole('combobox', { name: '内置模型', exact: true });
  const modelImages: Buffer[] = [];
  for (const id of ['bunny', 'teapot', 'monkey']) {
    await selector.selectOption(id);
    await expect.poll(async () => (await anamorphSaved(page)).modelId).toBe(id);
    await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
    await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
    await page.waitForTimeout(350);
    const image = await page.getByTestId('anamorph-eye').screenshot();
    const rendered = await readPng(page, image);
    expect(rendered.modelColored).toBeGreaterThan(100);
    for (const previous of modelImages) expect(image).not.toEqual(previous);
    modelImages.push(image);
    await snap(page, `anamorph-${id}.png`);
  }
  await page.setViewportSize({ width: 851, height: 1400 });
  await page.waitForTimeout(200);
  expect((await readPng(page, await page.getByTestId('anamorph-eye').screenshot())).modelColored).toBeGreaterThan(100);
  const space = await readPng(page, await page.getByTestId('anamorph-space').screenshot());
  expect(space.goldCount).toBeGreaterThan(10);
  expect(space.goldMinX).toBeGreaterThan(2);
  expect(space.goldMaxX).toBeLessThan(space.width - 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  await snap(page, 'anamorph-monkey-851x1400.png');
  expect(errors).toEqual([]);
});

async function readPng(page: Page, buffer: Buffer) {
  return page.evaluate(async encoded => {
    const img = new Image();
    img.src = `data:image/png;base64,${encoded}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let transparent = 0, visible = 0, colored = 0, modelColored = 0, goldCount = 0, goldMinX = img.width, goldMaxX = -1;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) transparent++;
      if (data[i + 3] > 200) visible++;
      if (data[i + 3] > 200 && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 15) colored++;
      // Both checkerboard colors are darker than 65 in every channel.
      if (data[i + 3] > 200 && data[i] > 65 && data[i + 1] > 90 && data[i + 2] > 90 && (data[i + 2] - data[i] > 15 || data[i + 1] - data[i] > 15)) modelColored++;
      if (data[i + 3] > 200 && data[i] > 160 && data[i + 1] > 100 && data[i + 2] < 160 && data[i] - data[i + 1] > 20 && data[i + 1] - data[i + 2] > 20) {
        const x = (i / 4) % img.width;
        goldCount++; goldMinX = Math.min(goldMinX, x); goldMaxX = Math.max(goldMaxX, x);
      }
    }
    return { width: img.width, height: img.height, transparent, visible, colored, modelColored, goldCount, goldMinX, goldMaxX };
  }, buffer.toString('base64'));
}

test('transparent PNG contains the warped drawing plane at its physical aspect ratio', async ({ page }) => {
  await ready(page);
  await anamorphReady(page);
  await page.getByRole('combobox', { name: '内置模型', exact: true }).selectOption('box');
  await page.getByRole('combobox', { name: '导出分辨率', exact: true }).selectOption('1024');
  const nextDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出透明PNG', exact: true }).click();
  const download = await nextDownload;
  const buffer = await readFile((await download.path())!);
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const png = await readPng(page, buffer);
  const params = await anamorphSaved(page);
  const points: [number, number, number][] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(modelPointToWorld([x, y, z], params.rotationDeg));
  const expected = exportDimensions(planeBounds(points, eyePosition(params)), 1024);
  expect({ width: png.width, height: png.height }).toEqual(expected);
  expect(Math.max(png.width, png.height)).toBe(1024);
  expect(png.transparent).toBeGreaterThan(png.width * png.height * .05);
  expect(png.visible).toBeGreaterThan(png.width * png.height * .01);
  expect(png.colored).toBeGreaterThan(png.visible * .2);
  expect(png.width).not.toBe(png.height);
  console.log(`Verified transparent plane PNG: ${JSON.stringify(png)}`);
  await download.saveAs(resolve(screenshots, 'anamorph-export-transparent.png'));
});

test('FBX import produces a static projection and invalid input preserves the last model', async ({ page }) => {
  await ready(page);
  await anamorphReady(page);
  const input = page.locator('input[type=file][accept*=".fbx"]');
  await input.setInputFiles(resolve('tests/fixtures/stanford-bunny.fbx'));
  await expect.poll(async () => (await anamorphSaved(page)).modelId).toBe('fbx');
  await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
  await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
  const importedEye = await page.getByTestId('anamorph-eye').screenshot();
  expect((await readPng(page, importedEye)).modelColored).toBeGreaterThan(100);
  await snap(page, 'anamorph-fbx-import.png');
  await page.getByRole('button', { name: '深度线索', exact: true }).click();
  await anamorphReady(page);
  expect((await anamorphSaved(page)).modelId).toBe('fbx');
  expect(await page.getByTestId('anamorph-eye').screenshot()).toEqual(importedEye);
  await input.setInputFiles({ name: 'invalid.fbx', mimeType: 'application/octet-stream', buffer: Buffer.from('not an FBX model') });
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await anamorphSaved(page)).modelId).toBe('fbx');
  await expect(page.getByRole('button', { name: '导出透明PNG', exact: true })).toBeEnabled();
  expect(await page.getByTestId('anamorph-eye').screenshot()).toEqual(importedEye);
  await page.reload();
  await anamorphReady(page);
  await expect(page.getByRole('combobox', { name: '内置模型', exact: true })).toHaveValue('box');
});

test('optional spatial observation is independent and the main frame stays 16:9 on resize', async ({ page }) => {
  await ready(page);
  const initial = (await saved(page)).modules.d09;
  await page.getByRole('button', { name: '查看空间', exact: true }).click();
  const inspect = page.getByTestId('inspect-viewport');
  await expect(inspect).toBeVisible();
  const bounds = (await inspect.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 35);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 55, { steps: 8 });
  await page.mouse.up();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    const frame = (await page.getByTestId('shot-viewport').boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
    expect((await saved(page)).modules.d09).toEqual(initial);
  }
  await snap(page, 'simple-space.png');
});

test('subpath build loads every asset locally and restores anamorph parameters after reload', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:' && url.protocol !== 'blob:') { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  await ready(page, 'http://127.0.0.1:4181/stereo-perception-lab/');
  await anamorphReady(page);
  for (const modelId of ['monkey', 'teapot', 'bunny']) {
    await page.getByRole('combobox', { name: '内置模型', exact: true }).selectOption(modelId);
    await expect(page.locator('.anamorph-views')).toHaveAttribute('aria-busy', 'false');
    await expect.poll(async () => (await anamorphSaved(page)).modelId).toBe(modelId);
    expect((await readPng(page, await page.getByTestId('anamorph-eye').screenshot())).modelColored).toBeGreaterThan(100);
  }
  await setRange(page.getByRole('slider', { name: '视点方向', exact: true }), 55);
  await expect.poll(async () => (await anamorphSaved(page)).azimuthDeg).toBe(55);
  await page.reload();
  await anamorphReady(page);
  await expect(page.getByRole('slider', { name: '视点方向', exact: true })).toHaveValue('55');
  await expect(page.getByRole('combobox', { name: '内置模型', exact: true })).toHaveValue('bunny');
  expect(external).toEqual([]);
});

test.describe('touchscreen controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('mobile taps expose model, eye controls, and transparent export without horizontal overflow', async ({ page }) => {
    await ready(page);
    await anamorphReady(page);
    await page.getByRole('combobox', { name: '内置模型', exact: true }).selectOption('teapot');
    await expect.poll(async () => (await anamorphSaved(page)).modelId).toBe('teapot');
    await setRange(page.getByRole('slider', { name: '视点俯角', exact: true }), 45);
    await expect.poll(async () => (await anamorphSaved(page)).elevationDeg).toBe(45);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
    await snap(page, 'anamorph-mobile-390.png');
  });
});
