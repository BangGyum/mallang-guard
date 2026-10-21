import { dist } from '../core/math';
import type { ContentDb, Effect } from '../data/types';
import { enemiesInRange } from './targeting';
import type { BattleState, EnemyEntity, StageRuntime, UnitEntity } from './types';

export function chainTargets(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
  first: EnemyEntity,
  chain: Extract<Effect, { type: 'chain' }>,
): EnemyEntity[] {
  const available = enemiesInRange(content, stage, state, unit);
  const selected = [first];
  let previous = first;
  while (selected.length < chain.damageMuls.length) {
    const next = available
      .filter(
        (enemy) =>
          !selected.includes(enemy) && dist(previous.x, previous.y, enemy.x, enemy.y) <= chain.radius,
      )
      .sort(
        (a, b) =>
          dist(previous.x, previous.y, a.x, a.y) - dist(previous.x, previous.y, b.x, b.y) || a.uid - b.uid,
      )[0];
    if (!next) break;
    selected.push(next);
    previous = next;
  }
  return selected;
}
