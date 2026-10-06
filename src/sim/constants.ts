export const TICK_RATE = 30;
export const DP_MAX = 99;
export const DEFAULT_DP_PER_SEC = 1;
export const RETREAT_REFUND_RATIO = 0.5;
export const MIN_DAMAGE_RATIO = 0.05;
export const BLOCK_CONTACT_DIST = 0.7;
export const SLOW_CAP = 0.8;
export const SP_EPSILON = 1e-6;

export function secToTicks(sec: number): number {
  return sec > 0 ? Math.max(1, Math.round(sec * TICK_RATE)) : 0;
}
