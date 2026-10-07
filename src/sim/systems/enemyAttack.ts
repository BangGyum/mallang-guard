import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import { damageAmount } from '../formulas';
import { unitStats } from '../stats';
import type { BattleState, SimEvent } from '../types';

export function attackUnits(content: ContentDb, state: BattleState, events: SimEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.blockedBy === null || state.tick < enemy.stunUntilTick) continue;
    const def = content.enemies.get(enemy.enemyId);
    assert(def, 'battle.enemies: missing definition');
    if (def.atk === 0) continue;
    if (enemy.atkCooldown > 0) enemy.atkCooldown -= 1;
    if (enemy.atkCooldown > 0) continue;
    const unit = state.units.find((entry) => entry.uid === enemy.blockedBy && entry.hp > 0);
    if (!unit) continue;
    const stats = unitStats(content, unit);
    const amount = damageAmount(def.damageType, def.atk, stats.def, stats.res);
    const src = { kind: 'enemy' as const, uid: enemy.uid };
    const dst = { kind: 'unit' as const, uid: unit.uid };
    events.push({ type: 'attack', src, dst, damageType: def.damageType, ranged: false });
    unit.hp -= amount;
    events.push({ type: 'damage', dst, amount, damageType: def.damageType, src });
    enemy.atkCooldown = secToTicks(def.atkIntervalSec);
  }
}
