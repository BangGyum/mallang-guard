import { assert } from '../core/assert';
import type { Tile } from '../core/grid';
import type { ContentDb } from '../data/types';
import { rangeTilesFor } from './queries';
import type { BattleState, EnemyEntity, StageRuntime, UnitEntity } from './types';

export function remaining(stage: StageRuntime, enemy: Readonly<EnemyEntity>): number {
  const route = stage.routes.get(enemy.routeId);
  assert(route, `battle.routes: unknown route ${enemy.routeId}`);
  return route.length - enemy.dist;
}

function contains(tiles: Tile[], x: number, y: number): boolean {
  return tiles.some((tile) => tile.x === Math.floor(x) && tile.y === Math.floor(y));
}

export function pickEnemy(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
): EnemyEntity | undefined {
  const def = content.units.get(unit.unitId);
  assert(def, 'battle.units: missing definition');
  const alive = state.enemies.filter(
    (enemy) => enemy.hp > 0 && (def.canHitAir || !content.enemies.get(enemy.enemyId)?.flying),
  );
  for (const uid of unit.blocking) {
    const enemy = alive.find((entry) => entry.uid === uid);
    if (enemy) return enemy;
  }
  const tiles = rangeTilesFor(content, stage, unit.unitId, unit.tile, unit.dir);
  return alive
    .filter((enemy) => contains(tiles, enemy.x, enemy.y))
    .sort((a, b) => remaining(stage, a) - remaining(stage, b) || a.uid - b.uid)[0];
}

export function pickAlly(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
): UnitEntity | undefined {
  const tiles = rangeTilesFor(content, stage, unit.unitId, unit.tile, unit.dir);
  return state.units
    .filter((ally) => ally.hp > 0 && ally.hp < ally.maxHp && contains(tiles, ally.tile.x, ally.tile.y))
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid - b.uid)[0];
}
