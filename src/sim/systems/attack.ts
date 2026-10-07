import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { damageAmount, healedHp } from '../formulas';
import { unitStats } from '../stats';
import { pickAlly, pickEnemy } from '../targeting';
import type { BattleState, SimEvent, StageRuntime } from '../types';

export function attackEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if (unit.atkCooldown > 0) unit.atkCooldown -= 1;
    if (unit.atkCooldown > 0) continue;
    const def = content.units.get(unit.unitId);
    assert(def, 'battle.units: missing definition');
    const stats = unitStats(content, unit);
    const src = { kind: 'unit' as const, uid: unit.uid };
    if (def.damageType === 'heal') {
      const ally = pickAlly(content, stage, state, unit);
      if (!ally) continue;
      const dst = { kind: 'unit' as const, uid: ally.uid };
      events.push({ type: 'attack', src, dst, damageType: 'heal', ranged: true });
      const hp = healedHp(ally.hp, ally.maxHp, stats.atk);
      events.push({ type: 'heal', src, dst, amount: hp - ally.hp });
      ally.hp = hp;
    } else {
      const enemy = pickEnemy(content, stage, state, unit);
      if (!enemy) continue;
      const target = content.enemies.get(enemy.enemyId);
      assert(target, 'battle.enemies: missing definition');
      const dst = { kind: 'enemy' as const, uid: enemy.uid };
      const amount = damageAmount(def.damageType, stats.atk, target.def, target.res);
      events.push({ type: 'attack', src, dst, damageType: def.damageType, ranged: def.deployOn === 'high' });
      enemy.hp -= amount;
      events.push({ type: 'damage', dst, amount, damageType: def.damageType, src });
    }
    unit.atkCooldown = stats.atkIntervalTicks;
  }
}
