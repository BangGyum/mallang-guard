import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, frame } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.29';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
    [390, 844],
    [320, 568],
  ]) {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-15T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      // 독립 브라우저 계정에서 원본 일곱 맵에 접근합니다. 전투 수치는 그대로입니다.
      localStorage.setItem(
        'mallang-guard:v1',
        JSON.stringify({
          version: 1,
          settings: { quality: 'high', sfxVolume: 0, speed: 1, reducedMotion: true },
          stages: Object.fromEntries(
            Array.from({ length: 7 }, (_, i) => [`stage-${i + 1}`, { cleared: true, bestLife: 3 }]),
          ),
        }),
      );
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.getByRole('button', { name: '스테이지 선택', exact: true }).waitFor();
    const cdp = touch ? await context.newCDPSession(page) : null;
    const stages = [];
    for (let i = 1; i <= 7; i++) {
      await page.getByRole('button', { name: '스테이지 선택', exact: true }).click();
      await frame(page);
      const card = page.locator(`.stage-card[data-stage-id="stage-${i}"]`);
      await card.waitFor({ timeout: 10000 }).catch(async (error) => {
        await page.screenshot({ path: `docs/verification/${prefix}-theme-failure.png` });
        console.log(await page.locator('#app').evaluate((node) => node.outerHTML.slice(0, 2000)), errors);
        throw error;
      });
      await card.locator('.stage-name').scrollIntoViewIfNeeded();
      const preview = await card.evaluate((node) => {
        const map = node.querySelector('.stage-map');
        const style = getComputedStyle(map.querySelector('[data-tile="#"]'));
        const name = node.querySelector('.stage-theme');
        return { theme: map.dataset.stageTheme, name: name.textContent, blocked: style.backgroundColor };
      });
      if (i === 1 || i === 7)
        await page.screenshot({
          path: `docs/verification/${prefix}-${width}x${height}-select-${i}.png`,
        });
      await card.click();
      await frame(page, 300);
      assert.equal(await page.locator('#board').getAttribute('data-stage-theme'), preview.theme);
      const expected = await page.evaluate(async (i) => {
        const { stageThemeFor } = await import('/src/data/stageThemes.ts');
        const { content } = await import('/src/data/index.ts');
        const theme = stageThemeFor(`stage-${i}`);
        const stage = content.stages.get(`stage-${i}`);
        const tile = stage.map.flatMap((row, y) =>
          [...row].flatMap((char, x) => (char === 'H' ? [{ x, y }] : [])),
        )[0];
        return { theme, tile, map: stage.map };
      }, i);
      assert.equal(preview.name, expected.theme.name);
      const color = await page.evaluate((hex) => {
        const probe = document.createElement('span');
        probe.style.color = hex;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, expected.theme.blocked);
      assert.equal(preview.blocked, color);
      await deploy(page, cdp, 'squirrel', expected.tile, 'down');
      await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-stage-${i}.png` });
      assert(await page.locator('#board').evaluate((canvas) => canvas.style.background.includes('gradient')));
      await page.locator('[data-action="pause"]').click();
      await frame(page);
      await page.locator('[data-action="pause"]').click();
      await frame(page);
      await page.getByRole('button', { name: '타이틀로', exact: true }).click();
      await frame(page);
      assert.equal(await page.locator('#board').getAttribute('data-stage-theme'), null);
      assert.equal(await page.locator('#board').evaluate((canvas) => canvas.style.background), '');
      stages.push({ stage: i, ...preview, deployed: true, themeCleaned: true });
    }
    assert.deepEqual(errors, []);
    assert.equal(new Set(stages.map((stage) => stage.theme)).size, 7);
    report.push({ width, height, touch, stages, errors });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-stage-themes.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
