import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, drag, enterBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.32';
const unitId = process.env.MALLANG_ART_UNIT ?? 'wolf';
assert(['wolf', 'redPanda', 'fox'].includes(unitId));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
    [320, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const time = new Date('2026-10-16T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    const assets = await page.evaluate(async (unitId) => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { critterSvg } = await import('/src/art/critters.ts');
      const { WOLF_AIM_URL, ROKE_AIM_URL, LUA_AIM_URL } = await import('/src/art/characterArt.ts');
      const { content } = await import('/src/data/index.ts');
      // Isolated visual fixture: original combat values, enough deployment budget.
      content.stages.get('stage-1').startDp = 50;
      const source = new Image();
      source.src = unitId === 'wolf' ? WOLF_AIM_URL : unitId === 'fox' ? LUA_AIM_URL : ROKE_AIM_URL;
      await source.decode();
      const canvas = (await loadArtAssets()).get(unitId);
      const pixels = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 127) opaque++;
      return {
        width: source.naturalWidth,
        height: source.naturalHeight,
        transparentCorner: pixels[3] === 0,
        opaque,
        legacyPreserved: critterSvg(unitId).includes('<path'),
      };
    }, unitId);
    assert.equal(assets.width, 1509);
    assert.equal(assets.height, 1042);
    assert(assets.transparentCorner && assets.opaque > 9000 && assets.opaque < 40000);
    assert(assets.legacyPreserved);
    await enterBattle(page, { waitForStart: false });
    await pause(page);
    const card = page.locator(`.deploy-card[data-unit-id="${unitId}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await frame(page);
    assert.equal(await card.locator('image').count(), 1);
    assert.equal(await page.locator('.roster-avatar image').count(), 1);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}-${unitId}-card.png` });
    await page.locator('.roster-close').click();
    await drag(page, null, unitId, { x: 5, y: 1 });
    assert(await page.locator('.aim-directions').isVisible());
    await page.screenshot({ path: `docs/verification/${prefix}-${width}-${unitId}-preview.png` });
    await page.locator('[data-dir="left"]').click();
    await frame(page);
    assert.equal(await card.isVisible(), false);
    await page.locator('.deploy-card[data-unit-id="penguin"]').scrollIntoViewIfNeeded();
    await deploy(page, null, 'penguin', { x: 2, y: 0 }, 'down');
    await resume(page, unitId === 'wolf' ? 31000 : unitId === 'fox' ? 46000 : 41000);
    await pause(page);
    const point = await tilePoint(page, { x: 5, y: 1 });
    await page.mouse.click(point.x, point.y);
    await frame(page, 300);
    assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), unitId);
    assert.equal(await page.locator('.unit-panel image').count(), 1);
    assert.equal(await page.locator('.skill-button').isDisabled(), false);
    await page.locator('.skill-button').click();
    await frame(page, 120);
    assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
    await page.screenshot({ path: `docs/verification/${prefix}-${width}-${unitId}-skill.png` });
    await page.locator('.unit-popup-close').click();
    await resume(page, 500);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}-${unitId}-battle.png` });
    assert.deepEqual(errors, []);
    report.push({ width, height, assets, errors });
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-${unitId}-art.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error);
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      try {
        await page.screenshot({ path: `docs/verification/${prefix}-failure.png` });
        console.log(page.viewportSize(), await page.locator('body').innerText());
      } catch (captureError) {
        console.error('실패 화면 캡처 불가:', captureError.message);
      }
    }
  throw error;
} finally {
  await browser.close();
}
