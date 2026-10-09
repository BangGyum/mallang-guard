export async function createTestScene(enemyCount = 3) {
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const { createBattle } = await import('/src/sim/battle.ts');
  const { createBoardView } = await import('/src/view/boardView.ts');
  const { createOverlay } = await import('/src/view/overlay.ts');
  const raw = structuredClone(rawContent);
  raw.units.forEach((unit) => {
    unit.cost = 1;
  });
  raw.stages[0].deployLimit = raw.units.length;
  raw.stages[0].spawns = Array.from({ length: enemyCount }, (_, i) => {
    const enemy = raw.enemies[i % (enemyCount >= 60 ? raw.enemies.length : 3)];
    return {
      wave: 1,
      atSec: 0,
      enemy: enemy.id,
      count: 1,
      intervalSec: 0,
      route: enemy.flying ? 'air' : 'ground',
    };
  });
  const content = validateContent(raw);
  const battle = createBattle(content, 'stage-1');
  const view = createBoardView(
    document.querySelector('#board'),
    battle.stage.board,
    content,
    await loadArtAssets(),
  );
  const overlay = createOverlay(document.querySelector('#overlay'), battle.stage.board, content);
  const tiles = [
    [2, 0],
    [3, 0],
    [7, 0],
    [8, 0],
    [1, 2],
    [2, 2],
    [5, 2],
    [8, 3],
    [5, 1],
    [6, 4],
  ];
  raw.units.forEach((unit, i) => {
    battle.enqueue({
      type: 'deploy',
      unitId: unit.id,
      tile: { x: tiles[i][0], y: tiles[i][1] },
      dir: i % 2 ? 'left' : 'down',
    });
  });
  const events = battle.step();
  battle.state.enemies.forEach((enemy, i) => {
    enemy.x = enemy.px = 0.6 + (i % 10) * 1.02;
    enemy.y = enemy.py = 1.4 + Math.floor(i / 10) * 0.38;
    if (i % 3 === 0) enemy.slowAmount = 0.6;
    if (i % 3 === 1) enemy.stunUntilTick = 1000;
  });
  for (const unit of battle.state.units) {
    unit.skillState = unit.unitId === 'squirrel' ? 'ready' : 'active';
    if (unit.unitId === 'owl' || unit.unitId === 'wolf') {
      const skill = content.skills.get(content.units.get(unit.unitId).skill);
      unit.buffs = skill.effects;
    }
  }
  view.resize();
  overlay.resize();
  function deliver(batch) {
    view.onEvents(batch, battle.state);
    overlay.onEvents(batch, view.entityPosition);
  }
  function render(dt) {
    view.render(battle.state, 1, dt);
    overlay.render(battle.state, view.camera, 1, dt);
  }
  deliver(events);
  render(0.5);
  window.testScene = { battle, view, overlay, deliver, render };
}
