import type { BattleState, SimEvent } from '../types';

export function removeDeadEnemies(state: BattleState, events: SimEvent[]): void {
  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    if (enemy.blockedBy !== null) {
      const unit = state.units.find((unit) => unit.uid === enemy.blockedBy);
      if (unit) unit.blocking = unit.blocking.filter((uid) => uid !== enemy.uid);
      events.push({ type: 'unblock', unit: enemy.blockedBy, enemy: enemy.uid });
    }
    state.killed++;
    events.push({ type: 'enemyDie', uid: enemy.uid });
    return false;
  });
}
