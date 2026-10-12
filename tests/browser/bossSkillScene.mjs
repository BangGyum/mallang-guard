export async function createBossSkillGame(enemyId) {
  const { createApp } = await import('/src/app/app.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const source = await (await fetch('/src/app/battleSession.ts')).text();
  const module = source.match(/from ["']([^"']*\/sim\/battle\.ts[^"']*)["']/)?.[1];
  if (!module) throw new Error('전투 모듈 없음');
  const { Battle } = await import(module);
  if (!window.bossSkillAudit)
    for (const method of ['step', 'flush']) {
      const original = Battle.prototype[method];
      Battle.prototype[method] = function (...args) {
        const events = original.apply(this, args);
        window.bossSkillAudit.battle = this;
        window.bossSkillAudit.events.push(...events);
        return events;
      };
    }
  const images = window.bossSkillAudit?.images ?? (await loadArtAssets());
  window.bossSkillAudit?.game.dispose();
  document.body.innerHTML =
    '<div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>';
  const raw = structuredClone(rawContent);
  const def = raw.enemies.find((enemy) => enemy.id === enemyId);
  if (!def?.bossSkill) throw new Error('보스 스킬 없음');
  raw.stages = [
    {
      id: 'stage-1',
      name: '보스 스킬 단독 검사',
      startDp: 99,
      life: 3,
      deployLimit: 3,
      map: ['............', 'S..........G', '.HHH........', '............'],
      routes: { ground: { from: [0, 1], to: [11, 1] }, air: { from: [0, 1], to: [11, 1], flying: true } },
      spawns: [
        { wave: 1, atSec: 0, enemy: enemyId, count: 1, intervalSec: 0, route: def.flying ? 'air' : 'ground' },
        { wave: 2, atSec: 999, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' },
      ],
    },
  ];
  const content = validateContent(raw);
  window.bossSkillAudit = { images, content, events: [], battle: null, game: null };
  window.bossSkillAudit.game = createApp(content, document.querySelector('#app'), images);
  return def;
}

export async function bossSkillPoint(tile) {
  const { fitCamera, boardBox } = await import('/src/view/camera.ts');
  const { tileScreen } = await import('/src/view/picking.ts');
  const board = window.bossSkillAudit.battle.stage.board;
  const canvas = document.querySelector('#board');
  const height = canvas.clientHeight;
  const camera = fitCamera(
    boardBox(board.width, board.height),
    canvas.clientWidth / height,
    height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
  );
  return tileScreen(canvas, camera, board, tile);
}
