export async function seedRareShopProfile() {
  const { initialCollection } = await import('/src/data/recruitment.ts');
  localStorage.setItem(
    'mallang-guard:v1',
    JSON.stringify({
      version: 1,
      collection: {
        ...initialCollection(undefined, 1, true),
        money: 6000,
      },
    }),
  );
}

export async function createRareCombatScene() {
  const { createApp } = await import('/src/app/app.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const images = window.shopAudit.images;
  window.shopAudit.game.dispose();
  document.body.innerHTML =
    '<div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>';
  const raw = structuredClone(rawContent);
  raw.stages = [
    {
      id: 'stage-1',
      name: '희귀 3종 전투 단독 검사',
      startDp: 99,
      life: 3,
      deployLimit: 7,
      map: [
        '.........',
        '.........',
        '.........',
        '...H.....',
        'G..H....S',
        '...H.....',
        '.........',
        '.........',
        '.........',
      ],
      routes: { ground: { from: [8, 4], to: [0, 4] }, air: { from: [8, 4], to: [0, 4], flying: true } },
      spawns: [
        { wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' },
        { wave: 1, atSec: 10, enemy: 'crow', count: 1, intervalSec: 0, route: 'air' },
        { wave: 1, atSec: 20, enemy: 'jelly', count: 2, intervalSec: 10, route: 'ground' },
        { wave: 1, atSec: 40, enemy: 'bigJelly', count: 1, intervalSec: 0, route: 'ground' },
      ],
    },
  ];
  raw.enemies = raw.enemies.map((enemy) => ({
    ...enemy,
    hp: 1000000,
    speed: 0.06,
    bossSkill: undefined,
    rush: undefined,
  }));
  const content = validateContent(raw);
  window.shopAudit = { images, content, events: [], battle: null, game: null };
  window.shopAudit.game = createApp(content, document.querySelector('#app'), images);
}

export async function rareCombatPoint(tile) {
  const { fitCamera, boardBox } = await import('/src/view/camera.ts');
  const { tileScreen } = await import('/src/view/picking.ts');
  const board = window.shopAudit.battle.stage.board;
  const canvas = document.querySelector('#board');
  const height = canvas.clientHeight;
  const camera = fitCamera(
    boardBox(board.width, board.height),
    canvas.clientWidth / height,
    height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
  );
  return tileScreen(canvas, camera, board, tile);
}

export function readRareCombat() {
  const { state, content } = window.shopAudit.battle;
  const events = window.shopAudit.events;
  const units = state.units.map((unit) => ({ ...unit }));
  const boss = state.enemies.find((enemy) => content.enemies.get(enemy.enemyId)?.boss);
  const shots = events.filter((event) => event.type === 'attack');
  const fox = units.find((unit) => unit.unitId === 'fox');
  const bossShots =
    boss && fox ? shots.filter((event) => event.src.uid === fox.uid && event.dst.uid === boss.uid) : [];
  return {
    tick: state.tick,
    dp: state.dp,
    life: state.life,
    units,
    starts: events.filter((event) => event.type === 'skillStart').map((event) => event.skillId),
    ends: events.filter((event) => event.type === 'skillEnd').map((event) => event.uid),
    chains: shots.filter((event) => event.chainFrom !== undefined).length,
    bossShots: bossShots.length,
    rejected: events.filter((event) => event.type === 'commandRejected'),
  };
}
