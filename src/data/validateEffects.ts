import type { Effect, SkillDef } from './types';
import { array, choice, fail, integer, numeric, positive, record, text } from './validateValues';

const EFFECT_TYPES = [
  'statMul',
  'blockAdd',
  'splash',
  'onHitSlow',
  'stunEveryNthHit',
  'gainDp',
  'healAllies',
  'pulseDamage',
  'slowAura',
  'pushback',
] as const;

export function parseEffect(value: unknown, path: string): Effect {
  const raw = record(value, path);
  const type = choice(raw.type, `${path}.type`, EFFECT_TYPES);
  switch (type) {
    case 'statMul':
      return {
        type,
        stat: choice(raw.stat, `${path}.stat`, ['atk', 'def', 'res', 'atkInterval'] as const),
        value: positive(raw.value, `${path}.value`),
      };
    case 'blockAdd':
      return { type, value: integer(raw.value, `${path}.value`) };
    case 'splash':
      return { type, radius: positive(raw.radius, `${path}.radius`) };
    case 'onHitSlow':
      return {
        type,
        amount: numeric(raw.amount, `${path}.amount`, 0, 1),
        sec: positive(raw.sec, `${path}.sec`),
      };
    case 'stunEveryNthHit':
      return { type, n: integer(raw.n, `${path}.n`, 1), sec: positive(raw.sec, `${path}.sec`) };
    case 'gainDp':
      return { type, value: numeric(raw.value, `${path}.value`) };
    case 'healAllies':
      return { type, ratioOfMaxHp: numeric(raw.ratioOfMaxHp, `${path}.ratioOfMaxHp`, 0, 1) };
    case 'pulseDamage':
      return {
        type,
        count: integer(raw.count, `${path}.count`, 1),
        intervalSec: positive(raw.intervalSec, `${path}.intervalSec`),
        atkMul: positive(raw.atkMul, `${path}.atkMul`),
        damageType: choice(raw.damageType, `${path}.damageType`, ['physical', 'magic'] as const),
      };
    case 'slowAura':
      return { type, amount: numeric(raw.amount, `${path}.amount`, 0, 1) };
    case 'pushback':
      return { type, tiles: positive(raw.tiles, `${path}.tiles`) };
  }
}

export function parseEffects(value: unknown, path: string): Effect[] {
  return array(value, path).map((effect, index) => parseEffect(effect, `${path}[${index}]`));
}

export function parseSkill(value: unknown, path: string): SkillDef {
  const raw = record(value, path);
  const skill: SkillDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    description: text(raw.description, `${path}.description`),
    charge: choice(raw.charge, `${path}.charge`, ['auto', 'attack', 'hit'] as const),
    spCost: positive(raw.spCost, `${path}.spCost`),
    spStart: numeric(raw.spStart, `${path}.spStart`),
    trigger: choice(raw.trigger, `${path}.trigger`, ['manual', 'auto'] as const),
    condition: choice(raw.condition, `${path}.condition`, [
      'always',
      'enemyInRange',
      'allyDamagedInRange',
    ] as const),
    durationSec: numeric(raw.durationSec, `${path}.durationSec`),
    effects: parseEffects(raw.effects, `${path}.effects`),
  };
  if (skill.spStart > skill.spCost) fail(`${path}.spStart`, 'must not exceed spCost');
  for (const [index, effect] of skill.effects.entries()) {
    const instant = ['gainDp', 'healAllies', 'pushback'].includes(effect.type);
    if ((skill.durationSec === 0) !== instant) {
      fail(`${path}.effects[${index}].type`, 'effect does not match skill duration');
    }
    if (effect.type === 'pulseDamage' && skill.durationSec < (effect.count - 1) * effect.intervalSec) {
      fail(`${path}.durationSec`, 'too short for all pulseDamage hits');
    }
  }
  return skill;
}
