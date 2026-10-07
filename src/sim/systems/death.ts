import type { BattleState, SimEvent } from '../types';

export function removeDead(state: BattleState, events: SimEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) continue;
    state.killed += 1;
    events.push({ type: 'enemyDie', uid: enemy.uid });
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}
