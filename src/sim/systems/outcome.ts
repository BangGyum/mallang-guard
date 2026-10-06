import type { BattleState, SimEvent, StageRuntime } from '../types';

export function checkOutcome(stage: StageRuntime, state: BattleState, events: SimEvent[]): void {
  const allSpawned = stage.spawns.every((group, index) => state.spawnCursor[index] === group.count);
  if (state.phase === 'running' && allSpawned && state.enemies.length === 0 && state.life > 0) {
    state.phase = 'won';
    events.push({ type: 'battleEnd', result: 'won' });
  }
}
