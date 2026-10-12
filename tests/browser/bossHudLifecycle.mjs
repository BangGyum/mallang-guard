import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.21-recheck';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 740, height: 360 } });
  await page.context().grantPermissions(['local-network-access']);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.text());
  });
  await page.route('**/boss-lifecycle-check', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><div id="hud"></div></div>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/boss-lifecycle-check');
  const report = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const { createBattle } = await import('/src/sim/battle.ts');
    const { createHud } = await import('/src/ui/hud.ts');
    const definition = content.stages.get('stage-2');
    const original = definition.spawns.find((spawn) => spawn.enemy === 'gateJelly');
    const stages = new Map(content.stages);
    stages.set('stage-2', {
      ...definition,
      spawns: [
        { ...original, atSec: 0, wave: 1 },
        { ...original, enemy: 'bigJelly', atSec: 10, wave: 2 },
      ],
    });
    const battle = createBattle({ ...content, stages }, 'stage-2');
    const root = document.querySelector('#hud');
    const controls = { paused: false, speed: 1, startInSec: 0 };
    const hud = createHud(root, battle, { start() {}, pause() {}, speed() {}, exit() {} });
    const snapshot = () => ({
      hidden: document.querySelector('.boss-hud').hidden,
      id: document.querySelector('.boss-hud').dataset.enemyId,
      caption: document.querySelector('.boss-caption').textContent,
      name: document.querySelector('.boss-name').textContent,
      hp: document.querySelector('.boss-hp').value,
      max: document.querySelector('.boss-hp').max,
      shieldHidden: document.querySelector('.boss-shield').hidden,
      shield: document.querySelector('.boss-shield').value,
      announcement: document.querySelector('.boss-announcement').textContent,
      phase: battle.state.phase,
      life: battle.state.life,
    });
    const step = () => {
      battle.step();
      hud.update(controls);
    };
    hud.update(controls);
    const empty = snapshot();
    step();
    const first = snapshot();
    for (let i = 0; i < 300; i++) step();
    const pair = snapshot();
    for (let i = 0; i < 60; i++) hud.update(controls);
    const repeated = snapshot();
    for (let i = 0; i < 12000 && battle.state.enemies.some((enemy) => enemy.enemyId === 'gateJelly'); i++)
      step();
    const handoff = snapshot();
    for (let i = 0; i < 12000 && battle.state.phase === 'running'; i++) step();
    const ended = snapshot();
    const waveHidden = document.querySelector('.wave-notice').hidden;
    hud.dispose();
    const remaining = root.children.length;
    const restarted = createBattle({ ...content, stages }, 'stage-2');
    const next = createHud(root, restarted, { start() {}, pause() {}, speed() {}, exit() {} });
    next.update(controls);
    const reset =
      document.querySelector('.boss-hud').hidden &&
      document.querySelector('.boss-announcement').textContent === '';
    restarted.step();
    next.update(controls);
    const restart = document.querySelector('.boss-hud').dataset.enemyId;
    next.dispose();
    return {
      empty,
      first,
      pair,
      repeated,
      handoff,
      ended,
      waveHidden,
      remaining,
      reset,
      restart,
      finalRemaining: root.children.length,
    };
  });
  assert(report.empty.hidden);
  assert.equal(report.first.id, 'gateJelly');
  assert.equal(report.first.shield, 900);
  assert.equal(report.first.hidden, false);
  assert.equal(report.pair.caption, '보스 ×2');
  assert.equal(report.pair.id, 'gateJelly', '동시 보스는 먼저 등장한 적을 표시');
  assert.equal(
    report.repeated.announcement,
    report.first.announcement,
    '매 프레임 출현 알림을 반복하지 않음',
  );
  assert.equal(report.handoff.phase, 'running');
  assert.equal(report.handoff.life, 1);
  assert.equal(report.handoff.id, 'bigJelly');
  assert.equal(report.handoff.name, '덩치젤리');
  assert.equal(report.handoff.caption, '보스');
  assert.equal(report.handoff.hp, 3500);
  assert.equal(report.handoff.max, 3500);
  assert(report.handoff.shieldHidden);
  assert.equal(report.handoff.shield, 0, '새 표시 대상에 이전 보호막 값이 남지 않음');
  assert.equal(report.ended.phase, 'lost');
  assert(report.ended.hidden && report.waveHidden);
  assert.equal(report.ended.announcement, '');
  assert.equal(report.remaining, 0);
  assert(report.reset);
  assert.equal(report.restart, 'gateJelly');
  assert.equal(report.finalRemaining, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    `docs/verification/${prefix}-boss-lifecycle.json`,
    `${JSON.stringify({ ...report, errors }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({ pair: true, handoff: true, shieldReset: true, ended: true, restart: true, errors }),
  );
} finally {
  await browser.close();
}
