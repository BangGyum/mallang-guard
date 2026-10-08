import { dist } from '../../core/math';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import type { BattleState, SimEvent } from '../types';

export function updateEnemyAbilities(content: ContentDb, state: BattleState, events: SimEvent[]): void {
  for (const enemy of state.enemies) {
    const ability = content.enemies.get(enemy.enemyId)?.disrupt;
    if (!ability || enemy.hp <= 0 || enemy.stunUntilTick > state.tick) continue;
    enemy.abilityCooldown = Math.max(0, enemy.abilityCooldown - 1);
    if (enemy.abilityCooldown > 0) continue;
    const targets = state.units
      .map((unit) => ({ unit, distance: dist(enemy.x, enemy.y, unit.tile.x + 0.5, unit.tile.y + 0.5) }))
      .filter((target) => target.distance <= ability.range)
      .sort((a, b) => a.distance - b.distance || a.unit.uid - b.unit.uid)
      .slice(0, ability.targets);
    if (!targets.length) continue;
    enemy.abilityCooldown = secToTicks(ability.intervalSec);
    for (const { unit } of targets) {
      unit.disruptedUntilTick = Math.max(
        unit.disruptedUntilTick,
        state.tick + secToTicks(ability.durationSec),
      );
      unit.disruptionMul = Math.max(unit.disruptionMul, ability.atkIntervalMul);
      events.push({ type: 'unitDisrupt', src: enemy.uid, uid: unit.uid, untilTick: unit.disruptedUntilTick });
    }
  }
}
