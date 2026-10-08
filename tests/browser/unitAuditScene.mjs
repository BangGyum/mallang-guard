export async function createUnitAuditGame({ dir }) {
  const { createApp } = await import('/src/app/app.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const { Battle } = await import('/src/sim/battle.ts');
  if (!window.unitAudit) {
    for (const method of ['step', 'flush']) {
      const original = Battle.prototype[method];
      Battle.prototype[method] = function (...args) {
        const events = original.apply(this, args);
        window.unitAudit.battle = this;
        window.unitAudit.events.push(...events);
        return events;
      };
    }
  }
  const images = window.unitAudit?.images ?? (await loadArtAssets());
  window.unitAudit?.game.dispose();
  document.body.innerHTML =
    '<div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>';
  const raw = structuredClone(rawContent);
  const offsets = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const [dx, dy] = offsets[dir];
  const from = [4 + dx, 4 + dy];
  raw.stages = [
    {
      id: 'stage-1',
      name: '캐릭터 단독 검증',
      startDp: 99,
      life: 3,
      deployLimit: 7,
      map: Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: 9 }, (_, x) =>
          x === 0 && y === 0 ? 'G' : x === 4 && y === 4 ? 'H' : x === from[0] && y === from[1] ? 'S' : '.',
        ).join(''),
      ),
      routes: { ground: { from, to: [0, 0] } },
      spawns: [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    },
  ];
  raw.enemies = raw.enemies.map((enemy) => ({ ...enemy, hp: 100000, speed: 0.001 }));
  const content = validateContent(raw);
  window.unitAudit = { images, content, events: [], battle: null, game: null };
  window.unitAudit.game = createApp(content, document.querySelector('#app'), images);
}

export async function unitAuditPoint() {
  const { fitCamera, boardBox } = await import('/src/view/camera.ts');
  const { tileScreen } = await import('/src/view/picking.ts');
  const board = window.unitAudit.battle.stage.board;
  const canvas = document.querySelector('#board');
  const height = canvas.clientHeight;
  const camera = fitCamera(
    boardBox(board.width, board.height),
    canvas.clientWidth / height,
    height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
  );
  return tileScreen(canvas, camera, board, { x: 4, y: 4 });
}
