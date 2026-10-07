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

export function contains(tiles: Tile[], x: number, y: number): boolean {
  return tiles.some((tile) => tile.x === Math.floor(x) && tile.y === Math.floor(y));
}

export function enemiesInRange(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
): EnemyEntity[] {
  const def = content.units.get(unit.unitId);
  assert(def, 'battle.units: missing definition');
  const alive = state.enemies.filter(
    (enemy) => enemy.hp > 0 && (def.canHitAir || !content.enemies.get(enemy.enemyId)?.flying),
  );
  const tiles = rangeTilesFor(content, stage, unit.unitId, unit.tile, unit.dir);
  return alive.filter((enemy) => contains(tiles, enemy.x, enemy.y));
}

export function pickEnemy(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
): EnemyEntity | undefined {
  return enemiesInRange(content, stage, state, unit).sort(
    (a, b) => remaining(stage, a) - remaining(stage, b) || a.uid - b.uid,
  )[0];
}
