import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import type { BattleState, SimEvent } from '../types';
import { releaseUnit, unblock } from './blocking';

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
    releaseUnit(state, unit, events);
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
