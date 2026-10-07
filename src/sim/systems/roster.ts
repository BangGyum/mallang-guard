import type { BattleState } from '../types';

export function updateRoster(state: BattleState): void {
  for (const slot of state.roster) {
    if (slot.state !== 'cooldown') continue;
    slot.cooldownTicks = Math.max(0, slot.cooldownTicks - 1);
    if (slot.cooldownTicks === 0) slot.state = 'ready';
  }
}
