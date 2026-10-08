import type { ContentDb } from '../../data/types';
import { enemiesInRange } from '../targeting';
import type { BattleState, SimEvent, StageRuntime } from '../types';
import { slowEnemy } from './damage';
import { updateSkillTimers } from './skills';

export function updateStatus(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  updateSkillTimers(content, stage, state, events);
  for (const enemy of state.enemies) {
    if (enemy.slowAmount > 0 && state.tick >= enemy.slowUntilTick) {
      enemy.slowAmount = 0;
      enemy.slowUntilTick = 0;
      events.push({ type: 'status', enemy: enemy.uid, kind: 'slow', on: false });
    }
    if (enemy.stunUntilTick > 0 && state.tick >= enemy.stunUntilTick) {
      enemy.stunUntilTick = 0;
      events.push({ type: 'status', enemy: enemy.uid, kind: 'stun', on: false });
    }
  }
  for (const unit of state.units) {
    if (unit.disruptedUntilTick <= state.tick) {
      unit.disruptedUntilTick = 0;
      unit.disruptionMul = 1;
    }
    for (const effect of unit.buffs) {
      if (effect.type !== 'slowAura') continue;
      for (const enemy of enemiesInRange(content, stage, state, unit))
        slowEnemy(enemy, effect.amount, state.tick + 1, state.tick, events);
    }
  }
}
