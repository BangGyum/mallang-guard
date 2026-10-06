export const TICK_RATE = 30;
export const DEFAULT_SEED = 1;

export function secToTicks(seconds: number): number {
  return seconds > 0 ? Math.max(1, Math.round(seconds * TICK_RATE)) : 0;
}
