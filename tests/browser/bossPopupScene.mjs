export async function createBossPopupScene({ tile, spawnAtSec = 0 }) {
  const { content } = await import('/src/data/index.ts');
  const { createBattle } = await import('/src/sim/battle.ts');
  const { createHud } = await import('/src/ui/hud.ts');
  const { createController } = await import('/src/ui/controller.ts');
  const { createDeployBar } = await import('/src/ui/deployBar.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { createBoardView } = await import('/src/view/boardView.ts');
  const { tileScreen } = await import('/src/view/picking.ts');
  window.bossPopupScene?.dispose();
  const stageId = 'stage-7';
  const definition = content.stages.get(stageId);
  const spawn = definition.spawns.find((group) => group.enemy === 'gardenKing');
  const stages = new Map(content.stages);
  stages.set(stageId, { ...definition, spawns: [{ ...spawn, atSec: spawnAtSec }] });
  const battle = createBattle({ ...content, stages }, stageId);
  document.querySelector('#app').innerHTML = '<canvas id="board"></canvas><div id="hud"></div>';
  const canvas = document.querySelector('#board');
  const root = document.querySelector('#hud');
  window.bossPopupAssets ??= await loadArtAssets();
  const view = createBoardView(canvas, battle.stage.board, battle.content, window.bossPopupAssets);
  const controls = { paused: false, speed: 1, startInSec: 0 };
  const hud = createHud(root, battle, {
    start() {},
    pause() {
      controls.paused = !controls.paused;
    },
    speed() {
      controls.speed = controls.speed === 1 ? 2 : 1;
    },
    exit() {
      window.bossPopupScene.dispose();
    },
  });
  const controller = createController(canvas, root, battle, view, {
    onModeChange() {},
    pause() {},
    menu() {},
    speed() {},
    notify(message) {
      throw new Error(message);
    },
  });
  const bar = createDeployBar(root, battle, controller.selectCard);
  const rejected = [];
  function render() {
    view.resize();
    controller.update();
    bar.update();
    hud.update(controls);
    view.render(battle.state, 1, 1 / 30);
  }
  function step(ticks) {
    for (let i = 0; i < ticks && battle.state.phase === 'running'; i++) {
      const events = battle.step();
      rejected.push(...events.filter((event) => event.type === 'commandRejected'));
      view.onEvents(events, battle.state);
      controller.onEvents(events);
    }
    render();
    return battle.state.phase;
  }
  window.bossPopupScene = {
    battle,
    rejected,
    render,
    step,
    point() {
      return tileScreen(canvas, view.camera, battle.stage.board, tile);
    },
    dispose() {
      controller.dispose();
      bar.dispose();
      hud.dispose();
      view.dispose();
      window.bossPopupScene = null;
    },
  };
  battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile, dir: 'right' });
  step(1);
  return window.bossPopupScene.point();
}
