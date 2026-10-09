import { assert } from '../../core/assert';
import { dist } from '../../core/math';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import { unitStats } from '../stats';
import { pickEnemies } from '../targeting';
import type { BattleState, SimEvent, StageRuntime } from '../types';
import { damageEnemy, slowEnemy, stunEnemy } from './damage';
import { chargeSkill, skillFor } from './skills';

export function attackEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const unit of state.units) {
    if (unit.atkCooldown > 0) unit.atkCooldown -= 1;
    if (unit.atkCooldown > 0) continue;
    const def = content.units.get(unit.unitId);
    assert(def, 'battle.units: missing definition');
    const effects = [...(def.traits ?? []), ...unit.buffs];
    const count = effects.find((effect) => effect.type === 'multiTarget')?.count ?? 1;
    const enemies = pickEnemies(content, stage, state, unit, count);
    if (enemies.length === 0) continue;
    const stats = unitStats(content, stage, state, unit);
    const radius = Math.max(0, ...effects.filter((e) => e.type === 'splash').map((e) => e.radius));
    if (unit.skillState === 'active') unit.skillHitCount += 1;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const targets = state.enemies.filter(
        (target) =>
          target.hp > 0 &&
          (target.uid === enemy.uid ||
            (radius > 0 &&
              dist(target.x, target.y, enemy.x, enemy.y) <= radius &&
              (def.canHitAir || !content.enemies.get(target.enemyId)?.flying))),
      );
      events.push({
        type: 'attack',
        src: { kind: 'unit', uid: unit.uid },
        dst: { kind: 'enemy', uid: enemy.uid },
        damageType: def.damageType,
        ranged: true,
      });
      for (const target of targets) {
        damageEnemy(content, unit, target, stats.atk, def.damageType, events);
        for (const effect of effects) {
          if (effect.type === 'onHitSlow')
            slowEnemy(target, effect.amount, state.tick + secToTicks(effect.sec), state.tick, events);
          if (
            effect.type === 'stunEveryNthHit' &&
            target.uid === enemy.uid &&
            unit.skillHitCount % effect.n === 0
          )
            stunEnemy(target, state.tick + secToTicks(effect.sec), state.tick, events);
        }
      }
    }
    unit.atkCooldown = stats.atkIntervalTicks;
    if (skillFor(content, unit).charge === 'attack') chargeSkill(content, unit, 1, events);
  }
}
