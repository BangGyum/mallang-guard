export const TICK_RATE = 30;
export const DEFAULT_SEED = 1;
export const DP_MAX = 99;
export const DEFAULT_DP_PER_SEC = 1;
export const RETREAT_REFUND_RATIO = 0.5;
export const MIN_DAMAGE_RATIO = 0.05;
export const BLOCK_CONTACT_DIST = 0.7;

export function secToTicks(seconds: number): number {
  return seconds > 0 ? Math.max(1, Math.round(seconds * TICK_RATE)) : 0;
}
