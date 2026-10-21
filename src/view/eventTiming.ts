import type { SimEvent } from '../sim/types';

export const PROJECTILE_SEC = 0.25;
export const PULSE_IMPACT_SEC = 0.4;

export function impactDelays(events: readonly SimEvent[]): ReadonlyMap<SimEvent, number> {
  const sourceDelays = new Map<number, number>();
  const delays = new Map<SimEvent, number>();
  const lastImpact = new Map<number, number>();
  for (const event of events) {
    if (event.type === 'gravityField' && event.phase === 'burst') sourceDelays.delete(event.uid);
    if (event.type === 'skillPulse') sourceDelays.set(event.uid, PULSE_IMPACT_SEC);
    if (event.type === 'attack') sourceDelays.set(event.src.uid, event.ranged ? PROJECTILE_SEC : 0);
    const delay = event.type === 'damage' && event.src ? sourceDelays.get(event.src.uid) : undefined;
    if (event.type === 'damage' && delay) {
      delays.set(event, delay);
      lastImpact.set(event.dst.uid, delay);
    }
    if (event.type === 'damage' && !delays.has(event)) lastImpact.delete(event.dst.uid);
    if (event.type === 'enemyDie' && lastImpact.has(event.uid))
      delays.set(event, lastImpact.get(event.uid) ?? 0);
    if (event.type === 'enemySpawn' && event.parentUid !== undefined)
      delays.set(event, lastImpact.get(event.parentUid) ?? 0);
  }
  return delays;
}
