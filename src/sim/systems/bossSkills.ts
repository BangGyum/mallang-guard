import { assert } from '../../core/assert';
import { dist } from '../../core/math';
import type { BossSkillDef, ContentDb, EnemyDef } from '../../data/types';
import { SPLIT_SPACING, secToTicks } from '../constants';
import type { BattleState, EnemyEntity, SimEvent, StageRuntime } from '../types';
import { spawnEnemy } from './spawn';

function inRange(enemy: EnemyEntity, x: number, y: number, range: number) {
  return dist(enemy.x, enemy.y, x, y) <= range;
}

function hasTarget(def: EnemyDef, enemy: EnemyEntity, state: BattleState) {
  const effect = def.bossSkill?.effect;
  if (!effect) return false;
  switch (effect.type) {
    case 'rush':
      return true;
    case 'shield':
      return enemy.shield < (def.shieldHp ?? 0);
    case 'summon':
      return enemy.summonsRemaining > 0;
    case 'heal':
      return state.enemies.some(
        (target) =>
          target.hp > 0 && target.hp < target.maxHp && inRange(enemy, target.x, target.y, effect.range),
      );
    case 'disrupt':
      return state.units.some((unit) => inRange(enemy, unit.tile.x + 0.5, unit.tile.y + 0.5, effect.range));
  }
}

function applySkill(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  enemy: EnemyEntity,
  def: EnemyDef,
  skill: BossSkillDef,
  events: SimEvent[],
) {
  const effect = skill.effect;
  switch (effect.type) {
    case 'rush':
      enemy.rushUntilTick = state.tick + secToTicks(effect.durationSec);
      break;
    case 'shield':
      enemy.shield = Math.min(def.shieldHp ?? 0, enemy.shield + effect.amount);
      break;
    case 'heal': {
      const targets = state.enemies
        .filter(
          (target) =>
            target.hp > 0 && target.hp < target.maxHp && inRange(enemy, target.x, target.y, effect.range),
        )
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid - b.uid)
        .slice(0, effect.targets);
      for (const target of targets) {
        const amount = Math.min(effect.amount, target.maxHp - target.hp);
        target.hp += amount;
        events.push({ type: 'enemyHeal', src: enemy.uid, uid: target.uid, amount });
      }
      break;
    }
    case 'summon': {
      if (enemy.summonsRemaining <= 0) break;
      const child = content.enemies.get(effect.enemy);
      const route = stage.routes.get(enemy.routeId);
      assert(child && route, 'bossSkill: missing child or route');
      for (let i = 0; i < effect.count; i++)
        spawnEnemy(
          child,
          enemy.routeId,
          route,
          state,
          events,
          Math.max(0, enemy.dist - (i + 1) * SPLIT_SPACING),
          enemy.uid,
        );
      state.totalEnemies += effect.count;
      enemy.summonsRemaining--;
      break;
    }
    case 'disrupt': {
      const targets = state.units
        .map((unit) => ({ unit, distance: dist(enemy.x, enemy.y, unit.tile.x + 0.5, unit.tile.y + 0.5) }))
        .filter((target) => target.distance <= effect.range)
        .sort((a, b) => a.distance - b.distance || a.unit.uid - b.unit.uid)
        .slice(0, effect.targets);
      for (const { unit } of targets) {
        unit.disruptedUntilTick = Math.max(
          unit.disruptedUntilTick,
          state.tick + secToTicks(effect.durationSec),
        );
        unit.disruptionMul = Math.max(unit.disruptionMul, effect.atkIntervalMul);
        events.push({
          type: 'unitDisrupt',
          src: enemy.uid,
          uid: unit.uid,
          untilTick: unit.disruptedUntilTick,
        });
      }
      break;
    }
  }
}

export function updateBossSkills(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
) {
  // 소환된 자식은 이 틱에 새 능력을 발동하지 않습니다.
  for (const enemy of [...state.enemies]) {
    const def = content.enemies.get(enemy.enemyId);
    const skill = def?.bossSkill;
    if (!def || !skill || enemy.hp <= 0) continue;
    if (enemy.stunUntilTick > state.tick) {
      if (enemy.bossCastUntilTick > 0) {
        enemy.bossCastUntilTick = 0;
        enemy.abilityCooldown = secToTicks(skill.intervalSec);
        events.push({ type: 'bossSkill', uid: enemy.uid, enemyId: def.id, phase: 'cancel' });
      }
      continue;
    }
    if (enemy.bossCastUntilTick > 0) {
      if (state.tick < enemy.bossCastUntilTick) continue;
      enemy.bossCastUntilTick = 0;
      enemy.abilityCooldown = secToTicks(skill.intervalSec);
      events.push({ type: 'bossSkill', uid: enemy.uid, enemyId: def.id, phase: 'cast' });
      applySkill(content, stage, state, enemy, def, skill, events);
      continue;
    }
    enemy.abilityCooldown = Math.max(0, enemy.abilityCooldown - 1);
    if (enemy.abilityCooldown > 0 || !hasTarget(def, enemy, state)) continue;
    enemy.bossCastUntilTick = state.tick + secToTicks(skill.windupSec);
    events.push({ type: 'bossSkill', uid: enemy.uid, enemyId: def.id, phase: 'windup' });
  }
}
