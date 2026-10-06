import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import type { BattleState, EnemyEntity, SimEvent } from '../types';

function unblock(state: BattleState, enemy: EnemyEntity, events: SimEvent[]): void {
  const uid = enemy.blockedBy;
  if (uid === null) return;
  const unit = state.units.find((entry) => entry.uid === uid);
  if (unit) unit.blocking = unit.blocking.filter((id) => id !== enemy.uid);
  enemy.blockedBy = null;
  events.push({ type: 'unblock', unit: uid, enemy: enemy.uid });
}

export function removeDead(content: ContentDb, state: BattleState, events: SimEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) continue;
    unblock(state, enemy, events);
    state.killed += 1;
    events.push({ type: 'enemyDie', uid: enemy.uid });
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  for (const unit of state.units) {
    if (unit.hp > 0) continue;
    for (const uid of [...unit.blocking]) {
      const enemy = state.enemies.find((entry) => entry.uid === uid);
      if (enemy) unblock(state, enemy, events);
    }
    const definition = content.units.get(unit.unitId);
    const slot = state.roster.find((entry) => entry.uid === unit.uid);
    assert(definition && slot, 'battle.units: missing definition or roster slot');
    slot.state = 'cooldown';
    slot.cooldownTicks = secToTicks(definition.redeploySec);
    slot.uid = null;
    events.push({ type: 'unitDie', uid: unit.uid });
  }
  state.units = state.units.filter((unit) => unit.hp > 0);
}
