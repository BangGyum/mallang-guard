import { type PerspectiveCamera, Vector3 } from 'three';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import { rangeTilesFor } from '../sim/queries';
import type { BattleState, SimEvent } from '../sim/types';
import { tileHeight } from './coords';
import type { createParticlePool } from './particlePool';

const ACCENTS: Readonly<Record<string, string>> = {
  acornPickup: 'signal',
  nyangCombo: 'crescentSlash',
  potLidGuard: 'hammerWave',
  snowballBarrage: 'iceLance',
  stardustShower: 'cometRound',
  carrotSoup: 'signal',
  tunnelAmbush: 'shockwave',
  stickyRoad: 'stickyDrop',
  wideBarrage: 'infernoRound',
  tripleAim: 'railRound',
  polarAim: 'chargedRail',
  siegeBarrage: 'shellRound',
  stormChain: 'flameBolt',
  eventHorizon: 'gravityCore',
};
type Pool = ReturnType<typeof createParticlePool>;
const ground = new Vector3();
const marker = new Vector3();
const end = new Vector3();
const MUZZLES: Readonly<Record<string, string>> = {
  penguin: 'frostFlash',
  bunny: 'energyPulse',
  snail: 'goo',
  sheep: 'plasmaImpact',
  fox: 'railFlash',
  redPanda: 'shellFlash',
  deer: 'flameBloom',
  snowLeopard: 'gravityOrb',
};

export function emitSkillMuzzle(
  pool: Pool,
  unitId: string,
  at: Vector3,
  size: number,
  active: boolean,
  quiet: boolean,
) {
  const specialized =
    active && unitId === 'fox'
      ? 'chargedRail'
      : active && unitId === 'snowLeopard'
        ? 'gravityCore'
        : MUZZLES[unitId];
  const width = size || (specialized ? 0.24 : 0);
  if (!width) return;
  pool.emit(
    specialized || (unitId === 'owl' ? 'fireBurst' : unitId === 'snowLeopard' ? 'gravityOrb' : 'muzzle'),
    at,
    at,
    active && !quiet ? 0.1 : 0.07,
    width * (quiet ? 0.65 : active ? 1.15 : 1),
    0,
    false,
    false,
    quiet ? 0.55 : 0.85,
  );
}

export function skillMark(skillId: string): string {
  return ACCENTS[skillId] ? `skill-${skillId}` : 'ring';
}

export function emitSkillStart(
  pool: Pool,
  content: ContentDb,
  board: Board,
  state: Readonly<BattleState>,
  event: Extract<SimEvent, { type: 'skillStart' }>,
  position: (uid: number) => Vector3 | undefined,
  quiet: boolean,
) {
  const unit = state.units.find((entry) => entry.uid === event.uid);
  const at = position(event.uid);
  if (!unit || !at) return;
  const mark = skillMark(event.skillId);
  ground.set(
    unit.tile.x + 0.5 - board.width / 2,
    tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'high') + 0.05,
    unit.tile.y + 0.5 - board.height / 2,
  );
  // 모션 감소에서도 즉시형 스킬의 발동 표식은 짧게 남깁니다.
  marker.copy(at);
  marker.y += 0.78;
  end.copy(marker);
  end.y += quiet ? 0 : 0.12;
  pool.emit(mark, marker, end, 0.4, quiet ? 0.44 : 0.54, 0, false, false, quiet ? 0.45 : 0.8);
  if (quiet) return;
  pool.emit(mark, ground, ground, 0.36, 0.38, 0, true, false, 0.42);
  const accent = ACCENTS[event.skillId];
  if (event.skillId === 'siegeBarrage') {
    for (const side of [-1, 1]) {
      end.set(ground.x + side * 0.3, ground.y, ground.z);
      pool.emit(mark, ground, end, 0.28, 0.22, 0, true, false, 0.4);
    }
  } else if (accent)
    for (const side of [-1, 1]) {
      end.set(at.x + side * 0.38, at.y + 0.16, at.z);
      pool.emit(accent, at, end, 0.28, 0.24, 0.08, false, false, 0.5);
    }
  if (event.skillId === 'carrotSoup') {
    const tiles = rangeTilesFor(content, { board }, unit.unitId, unit.tile, unit.dir, unit.buffs);
    for (const ally of state.units) {
      if (ally.uid === unit.uid || !tiles.some((tile) => tile.x === ally.tile.x && tile.y === ally.tile.y))
        continue;
      const to = position(ally.uid);
      if (!to) continue;
      end.set(to.x, to.y + 0.28, to.z);
      pool.emit('signal', to, end, 0.4, 0.34, 0, false, false, 0.55);
    }
  }
}

export function drawSkillMarks(
  pool: Pool,
  content: ContentDb,
  board: Board,
  state: Readonly<BattleState>,
  camera: PerspectiveCamera,
  time: number,
  quiet: boolean,
) {
  for (const unit of state.units) {
    if (unit.skillState !== 'active') continue;
    const def = content.units.get(unit.unitId);
    if (!def) continue;
    ground.set(
      unit.tile.x + 0.5 - board.width / 2,
      tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'high') + 0.04,
      unit.tile.y + 0.5 - board.height / 2,
    );
    pool.draw(
      skillMark(def.skill),
      ground,
      0.84 + (quiet ? 0 : Math.sin(time * 3) * 0.025),
      quiet ? 0.24 : 0.32,
      camera,
      true,
    );
  }
}
