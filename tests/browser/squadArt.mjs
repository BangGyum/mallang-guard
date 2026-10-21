import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const prefix = 't4.37';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/squad-art', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html lang="ko"><body></body></html>' }),
  );
  await page.goto('http://127.0.0.1:43195/squad-art');
  const assets = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const { CHARACTER_IMAGES, characterMarkup } = await import('/src/art/characterArt.ts');
    const { critterSvg } = await import('/src/art/critters.ts');
    const { loadArtAssets } = await import('/src/app/artAssets.ts');
    const { UNIT_PRESENTATION } = await import('/src/view/sprites.ts');
    const baked = await loadArtAssets();
    const results = [];
    document.body.style.cssText =
      'margin:0;padding:24px;background:#e8f3ee;color:#264c43;font:16px sans-serif;display:grid;grid-template-columns:repeat(5,1fr);gap:16px';
    for (const unit of content.units.values()) {
      const spec = CHARACTER_IMAGES[unit.art];
      if (!spec) throw new Error(`새 그림 누락: ${unit.id}`);
      const source = new Image();
      source.src = spec.url;
      await source.decode();
      const canvas = baked.get(unit.art);
      const pixels = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
      let opaque = 0;
      let lastRow = -1;
      let firstRow = 256;
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++)
          if (pixels[(y * 256 + x) * 4 + 3] > 127) {
            opaque++;
            firstRow = Math.min(firstRow, y);
            lastRow = y;
          }
      const tip = UNIT_PRESENTATION[unit.art].tip;
      const tx = Math.round((tip[0] + 0.5) * 256);
      const ty = Math.round((0.93 - tip[1]) * 256);
      let tipNearArt = false;
      for (let y = Math.max(0, ty - 10); y < Math.min(256, ty + 11); y++)
        for (let x = Math.max(0, tx - 10); x < Math.min(256, tx + 11); x++)
          if (pixels[(y * 256 + x) * 4 + 3] > 127) tipNearArt = true;
      const card = document.createElement('article');
      card.style.cssText = 'background:#fffdf5;border-radius:16px;padding:12px;text-align:center';
      card.innerHTML = `<strong>${unit.name}</strong><div style="height:200px">${characterMarkup(unit.art)}</div><small>${unit.animal}</small>`;
      card.querySelector('svg').style.cssText = 'width:100%;height:100%';
      document.body.append(card);
      results.push({
        id: unit.id,
        width: source.naturalWidth,
        height: source.naturalHeight,
        opaque,
        transparentCorner: pixels[3] === 0,
        firstRow,
        lastRow,
        tipNearArt,
        legacyPreserved: critterSvg(unit.art).includes('<path'),
      });
    }
    await Promise.all(
      [...document.querySelectorAll('image')].map((node) => {
        const image = new Image();
        image.src = node.getAttribute('href');
        return image.decode();
      }),
    );
    return results;
  });
  assert.equal(assets.length, 14);
  for (const asset of assets) {
    assert(asset.transparentCorner && asset.legacyPreserved, asset.id);
    assert(asset.opaque > 7000 && asset.opaque < 48000, `${asset.id} 투명 여백`);
    assert(asset.firstRow > 0 && Math.abs(asset.lastRow - 238) <= 3, `${asset.id} 발 앵커`);
    assert(asset.tipNearArt, `${asset.id} 무기 끝 좌표`);
  }
  await page.screenshot({ path: `docs/verification/${prefix}-squad-gallery.png`, fullPage: true });
  await page.route('**/squad-board', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
    }),
  );
  const boards = [];
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:43195/squad-board');
    await page.evaluate(createTestScene, 14);
    await page.evaluate(() => window.testScene.render(1));
    await page.screenshot({ path: `docs/verification/${prefix}-${width}-squad-board.png` });
    const metrics = await page.evaluate(() => {
      const { view } = window.testScene;
      const metrics = view.metrics;
      view.dispose();
      return { metrics, memory: view.memory };
    });
    assert(metrics.metrics.drawCalls <= 120 && metrics.metrics.particles <= 200);
    assert.deepEqual(metrics.memory, { geometries: 0, textures: 0 });
    boards.push({ width, height, ...metrics });
  }
  assert.deepEqual(errors, []);
  const report = { assets, boards, errors };
  await writeFile(`docs/verification/${prefix}-squad-art.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
