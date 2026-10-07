import { assert } from '../core/assert';
import type { ArtId, EnemyDef, RangeDef, SkillDef, UnitDef } from './types';
import { parseEffect } from './validateEffects';
import { bool, integer, list, number, object, oneOf, point, positive, text } from './validationHelpers';

const ART_IDS = [
  'squirrel',
  'cat',
  'bear',
  'penguin',
  'sheep',
  'bunny',
  'mole',
  'snail',
  'jelly',
  'hardJelly',
  'crow',
  'pudding',
] as const satisfies readonly ArtId[];

export function parseRange(value: unknown, path: string): RangeDef {
  const raw = object(value, path);
  return { id: text(raw.id, `${path}.id`), tiles: list(raw.tiles, `${path}.tiles`, point) };
}

export function parseUnit(value: unknown, path: string): UnitDef {
  const raw = object(value, path);
  const unit: UnitDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    animal: text(raw.animal, `${path}.animal`),
    role: oneOf(raw.role, `${path}.role`, [
      'vanguard',
      'guard',
      'defender',
      'sniper',
      'caster',
      'medic',
      'specialist',
      'supporter',
    ]),
    art: oneOf(raw.art, `${path}.art`, ART_IDS),
    atk: number(raw.atk, `${path}.atk`),
    atkIntervalSec: positive(raw.atkIntervalSec, `${path}.atkIntervalSec`),
    cost: number(raw.cost, `${path}.cost`),
    deployOn: oneOf(raw.deployOn, `${path}.deployOn`, ['high']),
    redeploySec: number(raw.redeploySec, `${path}.redeploySec`),
    range: text(raw.range, `${path}.range`),
    damageType: oneOf(raw.damageType, `${path}.damageType`, ['physical', 'magic']),
    canHitAir: bool(raw.canHitAir, `${path}.canHitAir`),
    skill: text(raw.skill, `${path}.skill`),
  };
  if (raw.traits !== undefined) {
    unit.traits = list(raw.traits, `${path}.traits`, parseEffect);
    for (const [index, trait] of unit.traits.entries()) {
      assert(
        ['statMul', 'splash', 'onHitSlow'].includes(trait.type),
        `${path}.traits[${index}].type: effect not allowed as trait`,
      );
    }
  }
  return unit;
}

export function parseEnemy(value: unknown, path: string): EnemyDef {
  const raw = object(value, path);
  return {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    art: oneOf(raw.art, `${path}.art`, ART_IDS),
    hp: positive(raw.hp, `${path}.hp`),
    def: number(raw.def, `${path}.def`),
    res: number(raw.res, `${path}.res`, 0, 100),
    speed: positive(raw.speed, `${path}.speed`),
    flying: bool(raw.flying, `${path}.flying`),
    lifeDamage: integer(raw.lifeDamage, `${path}.lifeDamage`, 1),
  };
}

export function parseSkill(value: unknown, path: string): SkillDef {
  const raw = object(value, path);
  const spCost = positive(raw.spCost, `${path}.spCost`);
  const skill: SkillDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    description: text(raw.description, `${path}.description`),
    charge: oneOf(raw.charge, `${path}.charge`, ['auto', 'attack']),
    spCost,
    spStart: number(raw.spStart, `${path}.spStart`, 0, spCost),
    trigger: oneOf(raw.trigger, `${path}.trigger`, ['manual', 'auto']),
    condition: oneOf(raw.condition, `${path}.condition`, ['always', 'enemyInRange']),
    durationSec: number(raw.durationSec, `${path}.durationSec`),
    effects: list(raw.effects, `${path}.effects`, parseEffect),
  };
  for (const [index, effect] of skill.effects.entries()) {
    const instant = ['gainDp', 'pushback'].includes(effect.type);
    assert(
      instant === (skill.durationSec === 0),
      `${path}.effects[${index}].type: effect incompatible with durationSec`,
    );
    if (effect.type === 'pulseDamage') {
      assert(
        skill.durationSec >= (effect.count - 1) * effect.intervalSec,
        `${path}.durationSec: shorter than pulse schedule`,
      );
    }
  }
  assert(
    skill.effects.filter((effect) => effect.type === 'pulseDamage').length <= 1,
    `${path}.effects: only one pulse schedule per skill`,
  );
  return skill;
}
