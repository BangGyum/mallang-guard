import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.11';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const settings of [
    { width: 1920, height: 1080, touch: false },
    { width: 844, height: 390, touch: true },
    { width: 740, height: 360, touch: true },
    { width: 390, height: 844, touch: true },
  ]) {
    const { touch, ...viewport } = settings;
    const label = `${touch ? 'touch' : 'mouse'}-${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    let moduleUrl;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/src/sim/battle.ts') moduleUrl = request.url();
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    const time = new Date('2026-10-09T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    await page.reload();
    await page.locator('.title-screen').waitFor();
    assert(moduleUrl);
    await page.evaluate(async (url) => {
      const { Battle } = await import(url);
      window.selectionAudit = { battle: null, rejected: [], skills: 0 };
      for (const name of ['step', 'flush']) {
        const original = Battle.prototype[name];
        Battle.prototype[name] = function (...args) {
          const events = original.apply(this, args);
          window.selectionAudit.battle = this;
          window.selectionAudit.rejected.push(...events.filter((e) => e.type === 'commandRejected'));
          window.selectionAudit.skills += events.filter((e) => e.type === 'skillStart').length;
          return events;
        };
      }
    }, moduleUrl);
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page, 250);
    };
    const select = async (tile) => {
      const point = await tilePoint(page, tile);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 300);
      await page.locator('.unit-popup-card').evaluate(async (card) => {
        await Promise.all(card.getAnimations().map((animation) => animation.finished));
      });
      return point;
    };
    await enterBattle(page, { waitForStart: false });
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('[data-action="pause"]').count(), 1);
    await pause(page);
    assert.equal(await page.locator('.dp-source').textContent(), '처치 보상');
    const units = await page.evaluate(() => [...window.selectionAudit.battle.content.units.values()]);
    const before = await page.evaluate(() => JSON.stringify(window.selectionAudit.battle.state));
    for (const unit of units) {
      await click(page.locator(`.deploy-card[data-unit-id="${unit.id}"]`));
      assert.equal(await page.locator('.roster-panel').getAttribute('data-unit-id'), unit.id);
      assert.equal(await page.locator('.roster-name').textContent(), unit.name);
      assert.match(await page.locator('.roster-stats').textContent(), new RegExp(`배치 도토리 ${unit.cost}`));
      assert.equal(await page.locator('.unit-panel').isVisible(), false);
      assert.equal(await page.locator('.roster-panel .skill-button').count(), 0);
      assert.equal(await page.locator('.drag-ghost').isVisible(), false);
      assert.equal(await page.locator('.aim-directions').isVisible(), false);
    }
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.selectionAudit.battle.state)),
      before,
      '카드 정보 선택으로 배치·도토리·전투 상태를 변경하지 않음',
    );
    await click(page.locator('.deploy-card[data-unit-id="wolf"]'));
    assert.equal(await page.locator('.roster-panel').getAttribute('data-deploy-available'), 'false');
    assert.match(await page.locator('.roster-deploy-hint').textContent(), /도토리/);
    const preview = await page.locator('.roster-panel').evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      const top = document.querySelector('.battle-top').getBoundingClientRect();
      const bar = document.querySelector('.deploy-bar').getBoundingClientRect();
      return {
        right: innerWidth - box.right,
        bottom: bar.top - box.bottom,
        topClear: box.top >= top.bottom + 7,
      };
    });
    assert(
      Math.abs(preview.right - 8) < 1 && Math.abs(preview.bottom - 8) < 1 && preview.topClear,
      '카드 정보는 오른쪽 아래 고정',
    );
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-card-info.png` });
    await click(page.locator('.roster-close'));
    await click(page.locator('.deploy-card[data-unit-id="squirrel"]'));
    await select({ x: 2, y: 0 });
    assert(await page.locator('.aim-directions').isVisible());
    await click(page.locator('[data-dir="down"]'));
    assert.equal(await page.locator('.roster-panel').isVisible(), false);
    const point = await select({ x: 2, y: 0 });
    assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), 'squirrel');
    assert.equal(await page.locator('.roster-panel').isVisible(), false);
    assert.equal(await page.locator('.skill-button').isDisabled(), true);
    const inspect = async (at) =>
      page.locator('.unit-panel').evaluate((panel, at) => {
        const box = panel.getBoundingClientRect();
        const top = document.querySelector('.battle-top').getBoundingClientRect();
        const bar = document.querySelector('.deploy-bar').getBoundingClientRect();
        const buttons = [...panel.querySelectorAll('button')]
          .filter((button) => button.getClientRects().length > 0)
          .map((button) => button.getBoundingClientRect().toJSON());
        return {
          fits:
            box.left >= 7 &&
            box.right <= innerWidth - 7 &&
            box.top >= top.bottom + 7 &&
            box.bottom <= bar.top - 7,
          avoidsUnit: at.x < box.left || at.x > box.right || at.y < box.top || at.y > box.bottom,
          buttons: buttons.every(
            (b) =>
              b.width >= 44 &&
              b.height >= 44 &&
              b.left >= box.left &&
              b.right <= box.right &&
              b.top >= box.top &&
              b.bottom <= box.bottom,
          ),
          skillHeight: panel.querySelector('.skill-button').getBoundingClientRect().height,
        };
      }, at);
    const charging = await inspect(point);
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-deployed-charging.png` });
    assert(
      charging.fits && charging.avoidsUnit && charging.buttons && charging.skillHeight >= 60,
      `유닛 옆 스킬 조작창과 버튼 전체 노출 ${JSON.stringify(charging)}`,
    );
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-deployed-charging.png` });
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 11000);
    await frame(page, 13000);
    await pause(page);
    await select({ x: 2, y: 0 });
    assert.equal(await page.locator('.skill-button').isDisabled(), false);
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-deployed-ready.png` });
    const beforeSkill = await page.evaluate(() => window.selectionAudit.battle.state.dp);
    await click(page.locator('.skill-button'));
    assert.equal(await page.evaluate(() => window.selectionAudit.battle.state.dp), beforeSkill);
    assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
    assert.equal(await page.evaluate(() => window.selectionAudit.skills), 1);
    assert.match(
      await page.locator('.skill-notice[data-unit-id="squirrel"]').textContent(),
      /토리.*전리품 수거/s,
    );
    await click(page.locator('.unit-popup-close'));
    const cdp = touch ? await context.newCDPSession(page) : null;
    await deploy(page, cdp, 'penguin', { x: 8, y: 2 }, 'left');
    const other = await select({ x: 8, y: 2 });
    const edge = await inspect(other);
    assert(edge.fits && edge.avoidsUnit && edge.buttons, '오른쪽 유닛은 반대편으로 조작창 이동');
    if (touch) {
      for (const size of [
        { width: 740, height: 360 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        await frame(page, 300);
        const resized = await inspect(await tilePoint(page, { x: 8, y: 2 }));
        assert(resized.fits && resized.buttons, '리사이즈 후 버튼 잘림 없음');
      }
      await page.setViewportSize(viewport);
      await frame(page, 300);
    }
    assert.equal(await page.locator('.retreat-note').textContent(), '환급 없음');
    const beforeRetreat = await page.evaluate(() => window.selectionAudit.battle.state.dp);
    await click(page.locator('.unit-retreat'));
    assert.equal(await page.evaluate(() => window.selectionAudit.battle.state.dp), beforeRetreat);
    assert.equal(await page.locator('.unit-panel').isVisible(), false);
    assert.equal(
      await page.locator('.deploy-card[data-unit-id="penguin"]').getAttribute('data-state'),
      'cooldown',
    );
    await click(page.locator('.deploy-card[data-unit-id="penguin"]'));
    assert.equal(await page.locator('.roster-panel').getAttribute('data-deploy-available'), 'false');
    await page.keyboard.press('Escape');
    await frame(page);
    assert.equal(await page.locator('.roster-panel').isVisible(), false);
    if (!touch) {
      await resume(page);
      await frame(page, 12000);
      await pause(page);
      await page.locator('.deploy-card[data-unit-id="mole"]').focus();
      await page.keyboard.press('Enter');
      await frame(page);
      assert.equal(await page.locator('.roster-panel').getAttribute('data-unit-id'), 'mole');
      await select({ x: 3, y: 0 });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await frame(page);
      assert(
        await page.evaluate(() => window.selectionAudit.battle.state.units.some((u) => u.unitId === 'mole')),
        '키보드 카드 선택·배치 유지',
      );
    }
    const rejected = await page.evaluate(() => window.selectionAudit.rejected);
    assert.deepEqual(rejected, []);
    assert.deepEqual(errors, []);
    report.push({
      viewport: label,
      cards: 10,
      preview,
      charging,
      edge,
      tapDeploy: true,
      dragDeploy: true,
      manualSkill: true,
      retreat: true,
      unavailableInfo: true,
      rejected,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-unit-selection.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
