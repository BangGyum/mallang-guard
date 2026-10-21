export async function createShopAuditGame({ defeat = false, nextStage = false } = {}) {
  const saveSource = await (await fetch('/src/app/save.ts')).text();
  const recruitmentModule = saveSource.match(/from ["']([^"']*\/data\/recruitment\.ts[^"']*)["']/)?.[1];
  if (!recruitmentModule) throw new Error('모집 모듈 없음');
  const { recruitment } = await import(recruitmentModule);
  // 전원 지급과 별도로 정식 모집·영입 흐름을 검사합니다.
  recruitment.unlockAllForTesting = false;
  const { createApp } = await import('/src/app/app.ts');
  const { loadArtAssets } = await import('/src/app/artAssets.ts');
  const { rawContent } = await import('/src/data/index.ts');
  const { validateContent } = await import('/src/data/validate.ts');
  const source = await (await fetch('/src/app/battleSession.ts')).text();
  const module = source.match(/from ["']([^"']*\/sim\/battle\.ts[^"']*)["']/)?.[1];
  if (!module) throw new Error('전투 모듈 없음');
  const { Battle } = await import(module);
  if (!window.shopAudit)
    for (const method of ['step', 'flush']) {
      const original = Battle.prototype[method];
      Battle.prototype[method] = function (...args) {
        const events = original.apply(this, args);
        window.shopAudit.battle = this;
        window.shopAudit.events.push(...events);
        return events;
      };
    }
  const images = window.shopAudit?.images ?? (await loadArtAssets());
  window.shopAudit?.game.dispose();
  document.body.innerHTML =
    '<div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>';
  const raw = structuredClone(rawContent);
  raw.stages = [
    {
      id: 'stage-1',
      name: '상점 보상 단독 검사',
      startDp: 99,
      life: defeat ? 1 : 3,
      deployLimit: 7,
      map: ['.....', 'HHHHH', 'S...G'],
      routes: {
        ground: { from: [0, 2], to: [4, 2] },
        air: { from: [0, 2], to: [4, 2], flying: true },
      },
      spawns: [
        { wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' },
        ...(defeat ? [{ wave: 1, atSec: 2, enemy: 'crow', count: 1, intervalSec: 0, route: 'air' }] : []),
      ],
    },
  ];
  if (nextStage) raw.stages.push({ ...raw.stages[0], id: 'stage-2', name: '다음 정원 이동 검사' });
  raw.enemies = raw.enemies.map((enemy) =>
    enemy.id === 'jelly' ? { ...enemy, hp: 1, speed: 0.1, def: 0 } : enemy,
  );
  const content = validateContent(raw);
  window.shopAudit = { images, content, events: [], battle: null, game: null };
  window.shopAudit.game = createApp(content, document.querySelector('#app'), images);
}

export async function shopPoint() {
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
  return tileScreen(canvas, camera, board, { x: 1, y: 1 });
}

export async function unluckyProfile() {
  const { mulberry32 } = await import('/src/core/rng.ts');
  const { initialCollection } = await import('/src/data/recruitment.ts');
  const { recruitUnitForRoll, recruitment } = await import('/src/data/recruitment.ts');
  for (let seed = 0; seed < 1000; seed++) {
    let state = seed,
      duplicates = true;
    for (let i = 0; i < 9; i++) {
      const next = mulberry32(state);
      state = next.state;
      if (!recruitment.starterUnits.includes(recruitUnitForRoll(recruitment.pool, next.value)))
        duplicates = false;
    }
    if (duplicates) {
      localStorage.setItem(
        'mallang-guard:v1',
        JSON.stringify({ version: 1, collection: initialCollection(undefined, seed) }),
      );
      return seed;
    }
  }
  throw new Error('미보유 보장 검증 시드 없음');
}
