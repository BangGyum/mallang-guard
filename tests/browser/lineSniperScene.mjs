export async function createLineSniperGame(count) {
  const { createApp } = await import('/src/app/app.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const { Battle } = await import('/src/sim/battle.ts');
  if (!window.lineSniperAudit) {
    for (const name of ['step', 'flush']) {
      const original = Battle.prototype[name];
      Battle.prototype[name] = function (...args) {
        const events = original.apply(this, args);
        window.lineSniperAudit.battle = this;
        window.lineSniperAudit.batches.push({ tick: this.state.tick, events });
        return events;
      };
    }
    const original = Battle.prototype.rangeTilesFor;
    Battle.prototype.rangeTilesFor = function (...args) {
      const tiles = original.apply(this, args);
      if (args[0] === 'wolf') window.lineSniperAudit.uiRange = tiles.length;
      return tiles;
    };
  }
  const images = window.lineSniperAudit?.images ?? (await loadArtAssets());
  window.lineSniperAudit?.game.dispose();
  document.body.innerHTML =
    '<div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>';
  const raw = structuredClone(rawContent);
  const rows = count === 1 ? [4] : [3, 4, 5];
  raw.stages = [
    {
      id: 'stage-1',
      name: '랑랑 동시 사격 검증',
      startDp: 99,
      life: 3,
      deployLimit: 7,
      map: Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: 13 }, (_, x) =>
          x === 5 && y === 4
            ? 'H'
            : rows.includes(y) && x === 9
              ? 'S'
              : rows.includes(y) && x === 12
                ? 'G'
                : '.',
        ).join(''),
      ),
      routes: Object.fromEntries(rows.map((y) => [`lane-${y}`, { from: [9, y], to: [12, y] }])),
      spawns: rows.map((y) => ({
        wave: 1,
        atSec: 0,
        enemy: 'jelly',
        count: 1,
        intervalSec: 0,
        route: `lane-${y}`,
      })),
    },
  ];
  raw.enemies = raw.enemies.map((enemy) => ({ ...enemy, hp: 100000, speed: 0.001 }));
  const content = validateContent(raw);
  window.lineSniperAudit = { images, content, game: null, battle: null, uiRange: 0, batches: [] };
  window.lineSniperAudit.game = createApp(content, document.querySelector('#app'), images);
}

export async function lineSniperPoint() {
  const { fitCamera, boardBox } = await import('/src/view/camera.ts');
  const { tileScreen } = await import('/src/view/picking.ts');
  const board = window.lineSniperAudit.battle.stage.board;
  const canvas = document.querySelector('#board');
  const height = canvas.clientHeight;
  const camera = fitCamera(
    boardBox(board.width, board.height),
    canvas.clientWidth / height,
    height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
  );
  return tileScreen(canvas, camera, board, { x: 5, y: 4 });
}
