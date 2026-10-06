import type { BattleState, SimEvent, StageRuntime } from '../types';

export function endBattle(state: BattleState, result: 'won' | 'lost', events: SimEvent[]): void {
  if (state.phase !== 'running') return;
  state.phase = result;
  events.push({ type: 'battleEnd', result });
}

export function checkOutcome(stage: StageRuntime, state: BattleState, events: SimEvent[]): void {
  if (state.life <= 0) endBattle(state, 'lost', events);
  else if (
    state.enemies.length === 0 &&
    stage.spawns.every((group, index) => state.spawnCursor[index] === group.count)
  ) {
    endBattle(state, 'won', events);
  }
}
