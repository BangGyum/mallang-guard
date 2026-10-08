import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

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
    await page.route('**/combat-art-check', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/combat-art-check');
    await page.evaluate(createTestScene, 8);
    const checks = await page.evaluate(async () => {
      const { createEntityViews } = await import('/src/view/entityViews.ts');
      const { createVfx } = await import('/src/view/vfx.ts');
      const { createTextures } = await import('/src/view/textures.ts');
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { hashState } = await import('/src/sim/hash.ts');
      const { battle, view } = window.testScene;
      const cache = createTextures(await loadArtAssets());
      const entities = createEntityViews(battle.content, battle.stage.board, cache.textures);
      entities.update(battle.state, view.camera, 1, 1);
      const vfx = createVfx(
        battle.content,
        battle.stage.board,
        cache.textures,
        entities.position,
        entities.attackOrigin,
      );
      const expected = [
        'bullet',
        'slash',
        'shockwave',
        'iceRound',
        'arcBolt',
        'arcBolt',
        'bullet',
        'stickyDrop',
      ];
      const checks = [];
      const originalHash = hashState(battle.state);
      for (const [index, unit] of battle.state.units.entries()) {
        const origin = entities.attackOrigin(unit.uid);
        const center = entities.position(unit.uid);
        const events = [
          {
            type: 'attack',
            src: { kind: 'unit', uid: unit.uid },
            dst: { kind: 'enemy', uid: battle.state.enemies[index].uid },
            damageType: battle.content.units.get(unit.unitId).damageType,
            ranged: true,
          },
        ];
        vfx.onEvents(events, battle.state, new Map());
        vfx.update(battle.state, view.camera, 0.04);
        const active = vfx.group.children
          .filter((mesh) => mesh.count > 0)
          .map(
            (mesh) =>
              [...cache.textures].find(([, texture]) => texture === mesh.material.uniforms.map.value)[0],
          );
        checks.push({
          id: unit.unitId,
          expected: expected[index],
          active,
          facing: Math.sign(origin.x - center.x) === (unit.dir === 'left' ? -1 : 1),
        });
        vfx.update(battle.state, view.camera, 1);
      }
      const unchanged = originalHash === hashState(battle.state);
      vfx.dispose();
      entities.dispose();
      cache.dispose();
      return { checks, unchanged };
    });
    assert(checks.unchanged, '연출이 전투 상태를 수정하지 않음');
    for (const check of checks.checks) {
      assert(check.active.includes(check.expected), `${check.id}의 전용 투사체`);
      assert(check.facing, `${check.id}의 좌우 방향과 무기 끝 발사 위치`);
    }
    await page.evaluate(() => {
      const { battle, deliver, render } = window.testScene;
      deliver(
        battle.state.units.map((unit, i) => ({
          type: 'attack',
          src: { kind: 'unit', uid: unit.uid },
          dst: { kind: 'enemy', uid: battle.state.enemies[i].uid },
          damageType: battle.content.units.get(unit.unitId).damageType,
          ranged: true,
        })),
      );
      render(0.05);
    });
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/t3.8-${label}-combat.png` });
    const paused = await page.locator('#board').screenshot();
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) window.testScene.render(0);
    });
    assert.deepEqual(await page.locator('#board').screenshot(), paused, '정지 중 무기 반동과 투사체 유지');
    await page.evaluate(() => {
      window.testScene.overlay.dispose();
      window.testScene.view.dispose();
    });
    if (!mobile) {
      await page.evaluate(async () => {
        const { content } = await import('/src/data/index.ts');
        const { critterSvg } = await import('/src/art/critters.ts');
        const weapons = [
          '소총 · 보급',
          '전투검 · 검기',
          '방패 · 충격 해머',
          '저격총 · 냉각탄',
          '아크 스태프 · 포격',
          '지원 소총 · 전술 가속',
          '산탄총 · 밀쳐내기',
          '점착탄 발사기 · 둔화',
        ];
        document.body.innerHTML =
          '<main><h1>말랑방위대 · 전투 장비</h1><p>고지대에서 자동 공격하는 8명의 동물 방위대</p><section></section></main>';
        const style = document.createElement('style');
        style.textContent =
          'body{margin:0;background:#e8f2ee;color:#304850;font-family:system-ui}main{max-width:1160px;margin:70px auto}h1{font-size:34px;margin:0 0 10px}p{font-size:17px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:28px}article{background:#fffcf3;border:1px solid #ccdcd3;border-radius:18px;padding:15px;text-align:center}article svg{width:190px;height:190px}h2{font-size:21px;margin:0 0 8px}article p{font-size:14px;margin:0 0 8px}small{color:#667876}';
        document.head.append(style);
        for (const [i, unit] of [...content.units.values()].entries()) {
          const card = document.createElement('article');
          card.innerHTML = `${critterSvg(unit.art)}<h2>${unit.name}</h2><p>${weapons[i]}</p><small>${content.skills.get(unit.skill).name}</small>`;
          document.querySelector('section').append(card);
        }
      });
      await page.locator('main').screenshot({ path: 'docs/verification/t3.8-combat-roster.png' });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: label, ...checks, paused: true, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
