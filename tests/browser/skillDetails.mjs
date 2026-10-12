import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createUnitAuditGame, unitAuditPoint } from './unitAuditScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.22';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
    [740, 360],
    [390, 844],
    [320, 568],
  ]) {
    const touch = width < 1000;
    const label = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const cdp = touch ? await context.newCDPSession(page) : null;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-12T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/skill-details-check', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/skill-details-check');
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page, 250);
    };
    const select = async () => {
      const point = await page.evaluate(unitAuditPoint);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 250);
    };
    const readState = () => page.evaluate(() => JSON.stringify(window.unitAudit.battle.state));
    const readInfo = (panel) =>
      page.locator(`${panel} .skill-details`).evaluate((section) => {
        const terms = [...section.querySelectorAll('dt')];
        return {
          id: section.dataset.skillId,
          open: section.open,
          facts: Object.fromEntries(
            terms.map((term) => [term.textContent, term.nextElementSibling.textContent]),
          ),
          effects: [...section.querySelectorAll('.skill-effects li')].map((item) => item.textContent),
          note: section.querySelector('.skill-info-note').textContent,
        };
      });
    const inspect = (panel) =>
      page.locator(panel).evaluate((root) => {
        const rect = root.getBoundingClientRect();
        const header = document.querySelector('.battle-top').getBoundingClientRect();
        const bar = document.querySelector('.deploy-bar').getBoundingClientRect();
        const toggle = root.querySelector('summary').getBoundingClientRect();
        const target = document.elementFromPoint(toggle.right - 16, toggle.top + toggle.height / 2);
        const scroller = root.querySelector('.unit-info-details, .roster-details').getBoundingClientRect();
        return {
          fits:
            rect.left >= 7 &&
            rect.right <= innerWidth - 7 &&
            rect.top >= header.bottom + 7 &&
            rect.bottom <= bar.top - 7,
          toggleFits:
            toggle.height >= 44 &&
            toggle.width >= 44 &&
            toggle.top >= scroller.top &&
            toggle.bottom <= scroller.bottom,
          toggleClickable: root.querySelector('summary').contains(target),
          buttonsFit: [...root.querySelectorAll('button')]
            .filter((button) => button.getClientRects().length > 0)
            .every((button) => {
              const box = button.getBoundingClientRect();
              return (
                box.width >= 44 &&
                box.height >= 44 &&
                box.top >= rect.top &&
                box.bottom <= rect.bottom &&
                box.left >= rect.left &&
                box.right <= rect.right
              );
            }),
        };
      });
    const units = await page.evaluate(async () => {
      const { content } = await import('/src/data/index.ts');
      return [...content.units.values()].map((unit) => ({
        ...unit,
        skillDef: content.skills.get(unit.skill),
      }));
    });
    const checks = [];
    for (const unit of units) {
      await page.evaluate(createUnitAuditGame, { dir: 'right' });
      await enterBattle(page);
      await pause(page);
      const initial = await readState();
      await click(page.locator(`.deploy-card[data-unit-id="${unit.id}"]`));
      const card = await readInfo('.roster-panel');
      const ability = unit.skillDef;
      assert.equal(card.id, ability.id);
      assert.equal(card.open, true, `${unit.id}: 카드 상세 기본 표시`);
      assert.equal(card.facts.지속, ability.durationSec === 0 ? '즉시 처리' : `${ability.durationSec}초`);
      assert.equal(card.facts.SP, `필요 ${ability.spCost} · 배치 시 ${ability.spStart}`);
      assert.equal(card.facts.발동, ability.trigger === 'manual' ? '수동 발동' : '조건 충족 시 자동 발동');
      assert.equal(card.effects.length, ability.effects.length);
      assert.match(card.note, /SP 0부터 재충전.*기본 능력치/);
      const cardBounds = await inspect('.roster-panel');
      assert(Object.values(cardBounds).every(Boolean), `${unit.id} 카드 ${JSON.stringify(cardBounds)}`);
      const cardToggle = page.locator('.roster-panel summary');
      await cardToggle.focus();
      await page.keyboard.press('Space');
      await frame(page);
      assert.equal((await readInfo('.roster-panel')).open, false);
      await page.keyboard.press('Enter');
      await frame(page);
      assert.equal((await readInfo('.roster-panel')).open, true);
      assert.equal(await readState(), initial, '정보 열기·접기·키보드 입력이 전투 상태를 바꾸지 않음');
      assert.equal(await page.locator('[data-action="pause"]').textContent(), '계속하기');
      const cardScroller = page.locator('.roster-details');
      await cardScroller.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      const bottomReadable = await page.locator('.roster-stats').evaluate((stats) => {
        const box = stats.getBoundingClientRect();
        return box.bottom <= stats.parentElement.getBoundingClientRect().bottom + 1;
      });
      assert(bottomReadable, `${unit.id}: 스크롤 끝까지 기본 능력치 확인`);
      await cardScroller.evaluate((node) => {
        node.scrollTop = 0;
      });
      if (['owl', 'wolf'].includes(unit.id) && [1920, 740].includes(width)) {
        await page.screenshot({
          path: `docs/verification/${prefix}-${label}-${unit.id}-card-details.png`,
          animations: 'disabled',
        });
      }
      if (width <= 390) {
        const box = await page.locator(`.deploy-card[data-unit-id="${unit.id}"]`).boundingBox();
        const point = await page.evaluate(unitAuditPoint);
        assert(box);
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
        });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await frame(page);
      } else await select();
      assert(await page.locator('.aim-directions').isVisible(), `${unit.id}: 기존 탭/드래그 배치 유지`);
      await click(page.locator('[data-dir="right"]'));
      await select();
      const closed = await readInfo('.unit-panel');
      assert.equal(closed.open, false, '스킬 조작창은 기본 접힘');
      const unitBounds = await inspect('.unit-panel');
      assert(Object.values(unitBounds).every(Boolean), `${unit.id} 스킬창 ${JSON.stringify(unitBounds)}`);
      const beforeDetails = await readState();
      await click(page.locator('.unit-panel .skill-info-label'));
      const deployed = await readInfo('.unit-panel');
      assert.equal(deployed.open, true);
      assert.deepEqual(deployed.facts, card.facts);
      assert.deepEqual(deployed.effects, card.effects);
      assert.equal(await readState(), beforeDetails, '상세 클릭으로 스킬을 사용하지 않음');
      const openBounds = await inspect('.unit-panel');
      assert(Object.values(openBounds).every(Boolean), `펼친 ${unit.id} ${JSON.stringify(openBounds)}`);
      assert.equal(await page.locator('.skill-button').isVisible(), ability.trigger === 'manual');
      if (ability.trigger === 'manual') assert(await page.locator('.skill-button').isDisabled());
      const scroller = page.locator('.unit-info-details');
      await scroller.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      const endReadable = await page.locator('.unit-stats').evaluate((stats) => {
        const box = stats.getBoundingClientRect();
        return box.bottom <= stats.parentElement.getBoundingClientRect().bottom + 1;
      });
      assert(endReadable, `${unit.id}: 설명 끝·현재 능력치까지 스크롤`);
      await scroller.evaluate((node) => {
        node.scrollTop = 0;
      });
      if (['owl', 'wolf'].includes(unit.id) && [1920, 740].includes(width)) {
        await page.screenshot({
          path: `docs/verification/${prefix}-${label}-${unit.id}-skill-details.png`,
          animations: 'disabled',
        });
      }
      const toggle = page.locator('.unit-panel summary');
      await toggle.focus();
      await page.keyboard.press('Space');
      await frame(page);
      assert.equal((await readInfo('.unit-panel')).open, false);
      await page.keyboard.press('Enter');
      await frame(page);
      assert.equal((await readInfo('.unit-panel')).open, true);
      assert.equal(await readState(), beforeDetails, '키보드 상세 열기·접기로 전투 상태 유지');
      assert.equal(await page.locator('[data-action="pause"]').textContent(), '계속하기');
      await page.keyboard.press('Escape');
      await frame(page);
      assert.equal(await page.locator('.unit-panel').isVisible(), false);
      let activation = false;
      if (unit.id === 'wolf' && [1920, 740].includes(width)) {
        await resume(page);
        await frame(page, 25000);
        await pause(page);
        await select();
        await click(page.locator('.unit-panel .skill-info-label'));
        assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'ready');
        assert.equal(await page.locator('.skill-button').isDisabled(), false);
        await click(page.locator('.skill-button'));
        assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
        assert.equal((await readInfo('.unit-panel')).open, true);
        assert.deepEqual(
          (await readInfo('.unit-panel')).effects,
          card.effects,
          '기본 예시는 발동 중에도 유지',
        );
        assert.match(await page.locator('.unit-stats').textContent(), /관통력 160/);
        activation = true;
      }
      assert.deepEqual(
        await page.evaluate(() =>
          window.unitAudit.events.filter((event) => event.type === 'commandRejected'),
        ),
        [],
      );
      assert.equal(
        await page.evaluate(
          () => window.unitAudit.events.filter((event) => event.type === 'skillStart').length,
        ),
        activation ? 1 : 0,
      );
      checks.push({
        unit: unit.id,
        skill: ability.name,
        facts: deployed.facts,
        effects: deployed.effects,
        cardBounds,
        unitBounds,
        openBounds,
        keyboard: true,
        scroll: true,
        activation,
      });
    }
    assert.deepEqual(errors, []);
    report.push({ viewport: label, input: touch ? 'touch' : 'mouse', checks, errors });
    await writeFile(`docs/verification/${prefix}-skill-details.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ viewport: label, characters: checks.length, errors }));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-skill-details.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
