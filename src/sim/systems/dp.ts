import { DEFAULT_DP_PER_SEC, DP_MAX, TICK_RATE } from '../constants';
import type { BattleState, StageRuntime } from '../types';

export function ticksPerDp(stage: StageRuntime): number {
  return Math.max(1, Math.round(TICK_RATE / (stage.definition.dpPerSec ?? DEFAULT_DP_PER_SEC)));
}

export function recoverDp(stage: StageRuntime, state: BattleState): void {
  if (state.dp >= DP_MAX) {
    state.dpTicks = 0;
    return;
  }
  state.dpTicks += 1;
  if (state.dpTicks >= ticksPerDp(stage)) {
    state.dp += 1;
    state.dpTicks = 0;
  }
}
