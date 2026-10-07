import { assert } from '../../core/assert';
import type { ContentDb, SkillDef } from '../../data/types';
import { DP_MAX, SP_EPSILON, secToTicks, TICK_RATE } from '../constants';
import { unitStats } from '../stats';
import { enemiesInRange, pickEnemy } from '../targeting';
import type { BattleState, SimEvent, StageRuntime, UnitEntity } from '../types';
import { damageEnemy } from './damage';

export function skillFor(content: ContentDb, unit: Readonly<UnitEntity>): SkillDef {
  const def = content.units.get(unit.unitId);
  const skill = def && content.skills.get(def.skill);
  assert(skill, 'battle.units: missing skill');
  return skill;
}

export function chargeSkill(content: ContentDb, unit: UnitEntity, amount: number, events: SimEvent[]): void {
  if (unit.skillState !== 'charging') return;
  const skill = skillFor(content, unit);
  unit.sp = Math.min(skill.spCost, unit.sp + amount);
  if (unit.sp < skill.spCost - SP_EPSILON) return;
  unit.sp = skill.spCost;
  unit.skillState = 'ready';
  events.push({ type: 'skillReady', uid: unit.uid });
}

export function skillHasTarget(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
): boolean {
  return skillFor(content, unit).condition === 'always' || !!pickEnemy(content, stage, state, unit);
}

function endSkill(unit: UnitEntity, tick: number, events: SimEvent[]): void {
  unit.sp = 0;
  unit.skillState = 'charging';
  unit.skillEndTick = tick;
  unit.buffs = [];
  unit.pulsesLeft = 0;
  unit.nextPulseTick = 0;
  events.push({ type: 'skillEnd', uid: unit.uid });
}

function pulse(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  unit: UnitEntity,
  events: SimEvent[],
): void {
  if (unit.pulsesLeft <= 0 || state.tick < unit.nextPulseTick) return;
  const effect = unit.buffs.find((entry) => entry.type === 'pulseDamage');
  assert(effect?.type === 'pulseDamage', 'battle.skill: missing pulse effect');
  const attack = unitStats(content, stage, state, unit).atk * effect.atkMul;
  events.push({ type: 'skillPulse', uid: unit.uid });
  for (const enemy of enemiesInRange(content, stage, state, unit))
    damageEnemy(content, unit, enemy, attack, effect.damageType, events);
  unit.pulsesLeft -= 1;
  unit.nextPulseTick += secToTicks(effect.intervalSec);
}

export function startSkill(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  unit: UnitEntity,
  events: SimEvent[],
): void {
  const skill = skillFor(content, unit);
  events.push({ type: 'skillStart', uid: unit.uid, skillId: skill.id });
  unit.skillHitCount = 0;
  unit.skillState = 'active';
  unit.skillEndTick = state.tick + secToTicks(skill.durationSec);
  unit.buffs = skill.durationSec > 0 ? skill.effects.map((effect) => ({ ...effect })) : [];
  for (const effect of skill.effects) {
    if (effect.type === 'gainDp') {
      const amount = Math.min(DP_MAX - state.dp, effect.value);
      state.dp += amount;
      if (state.dp === DP_MAX) state.dpTicks = 0;
      if (amount > 0) events.push({ type: 'dpGain', amount, source: 'skill' });
    }
    if (effect.type === 'pushback') {
      const enemy = pickEnemy(content, stage, state, unit);
      if (!enemy) continue;
      const route = stage.routes.get(enemy.routeId);
      assert(route, 'battle.skill: missing route');
      enemy.dist = Math.max(0, enemy.dist - effect.tiles);
      const position = route.positionAt(enemy.dist, enemy.segIndex);
      Object.assign(enemy, position, { px: position.x, py: position.y });
    }
    if (effect.type === 'pulseDamage') {
      unit.pulsesLeft = effect.count;
      unit.nextPulseTick = state.tick;
      // 틱 반올림으로 마지막 펄스가 지속시간보다 늦어지는 경우도 보존합니다.
      unit.skillEndTick = Math.max(
        unit.skillEndTick,
        state.tick + (effect.count - 1) * secToTicks(effect.intervalSec),
      );
      pulse(content, stage, state, unit, events);
    }
  }
  if (skill.durationSec === 0) endSkill(unit, state.tick, events);
}

export function updateSkillTimers(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const unit of state.units) {
    if (unit.skillState !== 'active') continue;
    pulse(content, stage, state, unit, events);
    if (state.tick >= unit.skillEndTick) endSkill(unit, state.tick, events);
  }
}

export function updateSkills(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const unit of state.units) {
    const skill = skillFor(content, unit);
    if (skill.charge === 'auto' && unit.skillEndTick !== state.tick)
      chargeSkill(content, unit, 1 / TICK_RATE, events);
    if (
      unit.skillState === 'ready' &&
      skill.trigger === 'auto' &&
      skillHasTarget(content, stage, state, unit)
    )
      startSkill(content, stage, state, unit, events);
  }
}
