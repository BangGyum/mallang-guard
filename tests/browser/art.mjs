import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't3.1';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
      hasTouch: mobile,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    await page.clock.install();
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-friend svg').first().waitFor();
    assert.equal(await page.locator('.title-friend svg').count(), 9);
    const art = await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const images = await loadArtAssets();
      return [...images].map(([id, canvas]) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) opaque++;
        return { id, opaque, total: canvas.width * canvas.height };
      });
    });
    assert.equal(art.length, 31);
    assert(art.every((image) => image.opaque > 100 && image.opaque < image.total * 0.9));
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-title.png` });
    await enterBattle(page);
    assert.equal(await page.locator('.card-portrait svg').count(), 9);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    await frame(page, 500);
    await page.screenshot({ path: `docs/verification/${prefix}-${label}.png` });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: label, images: art.length, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
