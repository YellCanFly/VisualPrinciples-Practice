import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.locator('.lab-canvas').waitFor();
await page.screenshot({ path: 'docs/screenshots/render-workspace.png', fullPage: true });
console.log(JSON.stringify({ errors, viewport: await page.locator('[data-testid="shot-viewport"]').boundingBox(), canvas: await page.locator('.lab-canvas').boundingBox() }));
for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  await page.setViewportSize(viewport);
  await page.locator('[data-testid="shot-viewport"]').screenshot({ path: `docs/screenshots/final-shot-${viewport.width}x${viewport.height}.png` });
  await page.screenshot({ path: `docs/screenshots/final-workspace-${viewport.width}x${viewport.height}.png`, fullPage: false });
  const boxes = {};
  for (const selector of ['[data-testid="shot-viewport"]','[data-testid="inspect-viewport"]','.metric-strip','.snapshot-bar','.timeline']) boxes[selector] = await page.locator(selector).boundingBox();
  console.log(JSON.stringify({ viewport, boxes }));
}
await browser.close();

const fallbackBrowser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl'] });
const fallback = await fallbackBrowser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await fallback.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await fallback.locator('.webgl-fallback').waitFor();
await fallback.screenshot({ path: 'docs/screenshots/final-webgl-fallback.png' });
await fallback.getByRole('button', { name: '文件与显示' }).click();
const downloaded = fallback.waitForEvent('download');
await fallback.getByRole('button', { name: '↓ 导出JSON', exact: true }).click();
const download = await downloaded;
console.log(JSON.stringify({ fallbackText: await fallback.locator('.webgl-fallback').innerText(), jsonDownload: download.suggestedFilename(), downloadFailure: await download.failure() }));
await fallbackBrowser.close();
