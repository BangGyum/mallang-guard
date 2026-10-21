import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';
import { enterBattle, frame } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't3.5';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 };
    const context = await browser.newContext({
      viewport,
      hasTouch: mobile,
      isMobile: mobile,
      deviceScaleFactor: 2,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-07T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(installAudioProbe);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 0);
    const settingsButton = page.getByRole('button', { name: '설정', exact: true });
    if (mobile) await settingsButton.tap();
    else await settingsButton.click();
    await frame(page);
    assert.equal(await page.evaluate(() => window.audioProbe.contexts[0].state), 'running');
    await page.getByRole('slider', { name: '효과음 볼륨' }).evaluate((node) => {
      node.value = '35';
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByLabel('화면 품질').selectOption('low');
    await page.getByLabel('전투 배속').selectOption('2');
    await page.getByLabel('움직임과 화면 흔들림').selectOption('reduce');
    await page.getByRole('button', { name: '소리 확인' }).click();
    assert.equal(await page.evaluate(() => window.audioProbe.sources), 1);
    assert.equal(await page.locator('#app').getAttribute('data-reduced-motion'), 'true');
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).settings);
    assert.deepEqual(settings, { speed: 2, quality: 'low', sfxVolume: 0.35, reducedMotion: true });
    const sizes = await page
      .locator('.settings-menu button, .settings-menu select, .settings-menu input')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    assert(
      sizes.every((height) => height >= 44),
      '설정 조작 영역 44px 이상',
    );
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-settings.png` });
    await page.getByRole('button', { name: '완료' }).click();
    await enterBattle(page);
    assert.equal(await page.locator('#board').evaluate((node) => node.width / node.clientWidth), 1);
    assert.equal(await page.locator('#overlay').evaluate((node) => node.width / node.clientWidth), 1);
    await page.locator('[data-action="pause"]').click();
    await page.locator('.pause-menu').getByRole('button', { name: '설정' }).click();
    await page.getByLabel('화면 품질').selectOption('high');
    await page.getByLabel('움직임과 화면 흔들림').selectOption('full');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await frame(page);
    assert.equal(
      await page.locator('#app').getAttribute('data-reduced-motion'),
      'false',
      '저장한 기본 움직임이 OS보다 우선',
    );
    assert.equal(await page.locator('#board').evaluate((node) => node.width / node.clientWidth), 2);
    await page.getByLabel('움직임과 화면 흔들림').selectOption('system');
    assert.equal(await page.locator('#app').getAttribute('data-reduced-motion'), 'true');
    await page.getByRole('button', { name: '음소거', exact: true }).click();
    const before = await page.evaluate(() => window.audioProbe.sources);
    await page.getByRole('button', { name: '소리 확인' }).click();
    assert.equal(await page.evaluate(() => window.audioProbe.sources), before);
    await page.getByRole('button', { name: '완료' }).click();
    assert.equal(await page.locator('.pause-menu').count(), 1);
    await page.locator('.pause-menu').getByRole('button', { name: '계속하기', exact: true }).click();
    await frame(page, 4000);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).settings.quality),
      'high',
      '수동 선택은 자동 전환보다 우선',
    );
    await page.locator('[data-action="pause"]').click();
    await page.locator('.pause-menu').getByRole('button', { name: '타이틀로' }).click();
    await enterBattle(page);
    await frame(page, 3100);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).settings.quality),
      'high',
      '수동 품질은 재시작 후에도 유지',
    );
    assert.equal(
      await page.evaluate(() => window.audioProbe.contexts.length),
      1,
      '앱당 오디오 컨텍스트 하나',
    );
    await page.locator('[data-action="pause"]').click();
    await page.locator('.pause-menu').getByRole('button', { name: '타이틀로' }).click();
    await page.reload();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    assert.equal(await page.getByLabel('전투 배속').inputValue(), '2');
    assert.equal(await page.getByLabel('화면 품질').inputValue(), 'high');
    assert.equal(await page.getByRole('slider').inputValue(), '0');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.settings-menu').count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ label, settings, liveDpr: [1, 2], persisted: true, errors }));
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const time = new Date('2026-10-07T03:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  await page.goto('http://127.0.0.1:43195/');
  await enterBattle(page);
  await frame(page, 3100);
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).settings.quality),
    'low',
  );
  console.log('10fps 환경에서 3초 뒤 낮은 품질 전환·저장 확인');
} finally {
  await browser.close();
}
