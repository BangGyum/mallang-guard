import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.10';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const touch of [false, true]) {
    const label = touch ? 'mobile' : 'desktop';
    const context = await browser.newContext({
      viewport: touch ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    await page.addInitScript(() => {
      const stages = {};
      for (let i = 1; i <= 6; i++) stages[`stage-${i}`] = { cleared: true, bestLife: 3 };
      localStorage.setItem('mallang-guard:v1', JSON.stringify({ version: 1, stages }));
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    const select = page.getByRole('button', { name: '스테이지 선택', exact: true });
    if (touch) await select.tap();
    else await select.click();
    const stage = page.locator('.stage-card[data-stage-id="stage-7"]');
    await stage.scrollIntoViewIfNeeded();
    assert.equal(await stage.locator('.stage-enemy').count(), 15);
    const labels = await stage
      .locator('.stage-enemy')
      .evaluateAll((nodes) =>
        nodes.map((n) => ({ name: n.textContent, title: n.title, svg: n.querySelector('svg') !== null })),
      );
    assert(labels.every((e) => e.svg && e.title.startsWith(e.name.trim())));
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-enemy-selection.png` });
    if (!touch) {
      const data = await page.evaluate(async () => {
        const { content } = await import('/src/data/index.ts');
        const { critterSvg } = await import('/src/art/critters.ts');
        const enemies = [...content.enemies.values()];
        document.body.innerHTML = '<main><h1>말랑방위대 · 적 15종</h1><section></section></main>';
        const style = document.createElement('style');
        style.textContent =
          'body{margin:0;background:#e5f1ec;color:#345349;font-family:system-ui}main{max-width:1260px;margin:30px auto}h1{font-size:28px}section{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}article{background:#fffdf3;border:1px solid #c6d9cc;border-radius:16px;padding:10px;text-align:center}svg{width:110px;height:110px}h2{font-size:18px;margin:0}small{font-size:11px;color:#567161}p{font-size:12px;line-height:1.4;margin:6px 0;min-height:35px}';
        document.head.append(style);
        for (const enemy of enemies) {
          const card = document.createElement('article');
          card.innerHTML = `${critterSvg(enemy.art)}<h2>${enemy.name}</h2><small>체력 ${enemy.hp} · 방어 ${enemy.def} · 마법 저항 ${enemy.res}%</small><p>${enemy.description ?? (enemy.flying ? '빠르게 날아오는 비행 적' : '경로를 따라오는 지상 적')}</p>`;
          document.querySelector('section').append(card);
        }
        return enemies.map(({ id, name, description }) => ({ id, name, description }));
      });
      assert.equal(data.length, 15);
      await page.locator('main').screenshot({ path: `docs/verification/${prefix}-enemy-roster.png` });
    }
    assert.deepEqual(errors, []);
    report.push({ viewport: label, enemies: 15, labels, errors });
    console.log(JSON.stringify({ viewport: label, enemies: 15, errors }));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-enemy-roster.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
