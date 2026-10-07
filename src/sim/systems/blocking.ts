import type { BattleState, EnemyEntity, SimEvent, UnitEntity } from '../types';

export function unblock(state: BattleState, enemy: EnemyEntity, events: SimEvent[]): void {
  const uid = enemy.blockedBy;
  if (uid === null) return;
  const unit = state.units.find((entry) => entry.uid === uid);
  if (unit) unit.blocking = unit.blocking.filter((id) => id !== enemy.uid);
  enemy.blockedBy = null;
  events.push({ type: 'unblock', unit: uid, enemy: enemy.uid });
}

export function releaseUnit(state: BattleState, unit: UnitEntity, events: SimEvent[]): void {
  for (const uid of [...unit.blocking]) {
    const enemy = state.enemies.find((entry) => entry.uid === uid);
    if (enemy) unblock(state, enemy, events);
  }
}
