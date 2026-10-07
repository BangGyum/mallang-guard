import type { SimEvent } from '../sim/types';

export const PROJECTILE_SEC = 0.25;

export function impactDelays(events: readonly SimEvent[]): ReadonlyMap<SimEvent, number> {
  const ranged = new Set<number>();
  const delays = new Map<SimEvent, number>();
  const lastImpact = new Map<number, number>();
  for (const event of events) {
    if (event.type === 'attack' && event.ranged) ranged.add(event.src.uid);
    if (event.type === 'damage' && event.src && ranged.has(event.src.uid)) {
      delays.set(event, PROJECTILE_SEC);
      lastImpact.set(event.dst.uid, PROJECTILE_SEC);
    }
    if (event.type === 'enemyDie' && lastImpact.has(event.uid))
      delays.set(event, lastImpact.get(event.uid) ?? 0);
  }
  return delays;
}
