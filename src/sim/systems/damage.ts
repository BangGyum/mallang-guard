import { assert } from '../../core/assert';
import type { ContentDb, DamageType } from '../../data/types';
import { SLOW_CAP } from '../constants';
import { damageAmount } from '../formulas';
import type { EnemyEntity, SimEvent, UnitEntity } from '../types';

export function damageEnemy(
  content: ContentDb,
  unit: Readonly<UnitEntity>,
  enemy: EnemyEntity,
  attack: number,
  damageType: DamageType,
  events: SimEvent[],
): void {
  const def = content.enemies.get(enemy.enemyId);
  assert(def, 'battle.enemies: missing definition');
  const amount = damageAmount(damageType, attack, def.def, def.res);
  enemy.hp -= amount;
  events.push({
    type: 'damage',
    dst: { kind: 'enemy', uid: enemy.uid },
    amount,
    damageType,
    src: { kind: 'unit', uid: unit.uid },
  });
}

export function slowEnemy(
  enemy: EnemyEntity,
  amount: number,
  until: number,
  tick: number,
  events: SimEvent[],
): void {
  const value = Math.min(SLOW_CAP, amount);
  if (value <= 0) return;
  const active = tick < enemy.slowUntilTick;
  if (active && value < enemy.slowAmount) return;
  enemy.slowUntilTick = active && value === enemy.slowAmount ? Math.max(until, enemy.slowUntilTick) : until;
  enemy.slowAmount = value;
  if (!active) events.push({ type: 'status', enemy: enemy.uid, kind: 'slow', on: true });
}

export function stunEnemy(enemy: EnemyEntity, until: number, tick: number, events: SimEvent[]): void {
  if (tick >= enemy.stunUntilTick) events.push({ type: 'status', enemy: enemy.uid, kind: 'stun', on: true });
  enemy.stunUntilTick = Math.max(enemy.stunUntilTick, until);
}
