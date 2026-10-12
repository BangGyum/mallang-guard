export async function createBossScene(stageId) {
  const { content } = await import('/src/data/index.ts');
  const { createBattle } = await import('/src/sim/battle.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { createBoardView } = await import('/src/view/boardView.ts');
  const { createOverlay } = await import('/src/view/overlay.ts');
  const { createHud } = await import('/src/ui/hud.ts');
  window.bossScene?.dispose();
  window.bossAssets ??= await loadArtAssets();
  const definition = content.stages.get(stageId);
  const wave = Math.max(...definition.spawns.map((group) => group.wave));
  const spawn = definition.spawns.find(
    (group) => group.wave === wave && content.enemies.get(group.enemy).boss,
  );
  const stages = new Map(content.stages);
  stages.set(stageId, { ...definition, spawns: [{ ...spawn, atSec: 0 }] });
  const battle = createBattle({ ...content, stages }, stageId);
  const app = document.querySelector('#app');
  app.innerHTML = '<canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div>';
  const board = document.querySelector('#board');
  const overlayCanvas = document.querySelector('#overlay');
  const root = document.querySelector('#hud');
  const view = createBoardView(board, battle.stage.board, battle.content, window.bossAssets);
  const overlay = createOverlay(overlayCanvas, battle.stage.board, battle.content);
  const controls = { paused: false, speed: 1, startInSec: 0 };
  const clicks = { pause: 0, speed: 0 };
  const hud = createHud(root, battle, {
    start() {},
    pause() {
      controls.paused = !controls.paused;
      clicks.pause++;
      hud.update(controls);
    },
    speed() {
      controls.speed = controls.speed === 1 ? 2 : 1;
      clicks.speed++;
      hud.update(controls);
    },
    exit() {
      window.bossScene.dispose();
    },
  });
  view.resize();
  overlay.resize();
  function render(dt = 1 / 30) {
    view.render(battle.state, 1, dt);
    overlay.render(battle.state, view.camera, 1, dt);
    hud.update(controls);
  }
  function step(ticks) {
    const rejected = [];
    for (let i = 0; i < ticks && battle.state.phase === 'running'; i++) {
      const events = battle.step();
      rejected.push(...events.filter((event) => event.type === 'commandRejected'));
      view.onEvents(events, battle.state);
      overlay.onEvents(events, view.entityPosition);
      if (i % 15 === 14) render(0.5);
    }
    render();
    if (rejected.length) throw new Error(JSON.stringify(rejected));
    return battle.state.phase;
  }
  window.bossScene = {
    battle,
    view,
    hud,
    controls,
    clicks,
    render,
    step,
    dispose() {
      hud.dispose();
      overlay.dispose();
      view.dispose();
      window.bossScene = null;
    },
    advanceToMiddle() {
      const route = battle.stage.routes.get(spawn.route);
      const def = content.enemies.get(spawn.enemy);
      step(Math.round(((route.length * 0.35) / def.speed) * 30));
    },
    deployAttacker() {
      const target = battle.state.enemies.find((enemy) => enemy.enemyId === spawn.enemy);
      const unitId = stageId === 'stage-1' ? 'squirrel' : 'penguin';
      const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
      const { board } = battle.stage;
      const route = battle.stage.routes.get(target.routeId);
      const speed = content.enemies.get(target.enemyId).speed;
      let best;
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (!battle.checkDeploy(unitId, { x, y }).ok) continue;
          for (const dir of ['right', 'down', 'left', 'up']) {
            const range = battle.rangeTilesFor(unitId, { x, y }, dir);
            if (!range.some((cell) => cell.x === tile.x && cell.y === tile.y)) continue;
            let score = 0;
            for (let seconds = 0; seconds <= 8; seconds += 0.5) {
              const point = route.positionAt(Math.min(route.length, target.dist + speed * seconds));
              if (range.some((cell) => cell.x === Math.floor(point.x) && cell.y === Math.floor(point.y)))
                score++;
            }
            if (!best || score > best.score) best = { tile: { x, y }, dir, score };
          }
        }
      }
      if (!best) throw new Error(`보스를 공격할 배치 칸 없음: ${stageId}`);
      battle.enqueue({ type: 'deploy', unitId, tile: best.tile, dir: best.dir });
      step(1);
      return unitId;
    },
  };
  step(1);
  const def = content.enemies.get(spawn.enemy);
  return { id: def.id, name: def.name, hp: def.hp, shield: def.shieldHp ?? 0 };
}
