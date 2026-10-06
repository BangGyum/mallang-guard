import type { ContentDb, EnemyDef, RangeDef, UnitDef } from './types';
import { parseEffects, parseSkill } from './validateEffects';
import { parseStage } from './validateStage';
import { array, boolean, choice, fail, numeric, pair, positive, record, text } from './validateValues';

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
] as const;

function parseUnit(value: unknown, path: string): UnitDef {
  const raw = record(value, path);
  const unit: UnitDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    animal: text(raw.animal, `${path}.animal`),
    role: choice(raw.role, `${path}.role`, [
      'vanguard',
      'guard',
      'defender',
      'sniper',
      'caster',
      'medic',
      'specialist',
      'supporter',
    ] as const),
    art: choice(raw.art, `${path}.art`, ART_IDS),
    cost: numeric(raw.cost, `${path}.cost`),
    deployOn: choice(raw.deployOn, `${path}.deployOn`, ['ground', 'high'] as const),
    redeploySec: numeric(raw.redeploySec, `${path}.redeploySec`),
    hp: positive(raw.hp, `${path}.hp`),
    atk: numeric(raw.atk, `${path}.atk`),
    def: numeric(raw.def, `${path}.def`),
    res: numeric(raw.res, `${path}.res`, 0, 100),
    atkIntervalSec: positive(raw.atkIntervalSec, `${path}.atkIntervalSec`),
    block: numeric(raw.block, `${path}.block`),
    range: text(raw.range, `${path}.range`),
    damageType: choice(raw.damageType, `${path}.damageType`, ['physical', 'magic', 'heal'] as const),
    canHitAir: boolean(raw.canHitAir, `${path}.canHitAir`),
    skill: text(raw.skill, `${path}.skill`),
  };
  if (unit.deployOn === 'high' && unit.block !== 0) fail(`${path}.block`, 'high units cannot block');
  if (raw.traits !== undefined) {
    unit.traits = parseEffects(raw.traits, `${path}.traits`);
    for (const [index, trait] of unit.traits.entries()) {
      if (!['statMul', 'splash', 'onHitSlow'].includes(trait.type)) {
        fail(`${path}.traits[${index}].type`, 'unsupported trait effect');
      }
    }
  }
  return unit;
}

function parseEnemy(value: unknown, path: string): EnemyDef {
  const raw = record(value, path);
  return {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    art: choice(raw.art, `${path}.art`, ART_IDS),
    hp: positive(raw.hp, `${path}.hp`),
    atk: numeric(raw.atk, `${path}.atk`),
    def: numeric(raw.def, `${path}.def`),
    res: numeric(raw.res, `${path}.res`, 0, 100),
    atkIntervalSec: positive(raw.atkIntervalSec, `${path}.atkIntervalSec`),
    speed: positive(raw.speed, `${path}.speed`),
    flying: boolean(raw.flying, `${path}.flying`),
    blockCost: positive(raw.blockCost, `${path}.blockCost`),
    lifeDamage: positive(raw.lifeDamage, `${path}.lifeDamage`),
    damageType: choice(raw.damageType, `${path}.damageType`, ['physical', 'magic'] as const),
  };
}

function parseRange(value: unknown, path: string): RangeDef {
  const raw = record(value, path);
  return {
    id: text(raw.id, `${path}.id`),
    tiles: array(raw.tiles, `${path}.tiles`).map((tile, index) => pair(tile, `${path}.tiles[${index}]`)),
  };
}

function table<T extends { id: string }>(
  value: unknown,
  path: string,
  parse: (item: unknown, itemPath: string) => T,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const [index, raw] of array(value, path).entries()) {
    const item = parse(raw, `${path}[${index}]`);
    if (result.has(item.id)) fail(`${path}[${index}].id`, `duplicate id "${item.id}"`);
    result.set(item.id, item);
  }
  return result;
}

export function validateContent(value: unknown): ContentDb {
  const raw = record(value, 'content');
  const units = table(raw.units, 'content/units', parseUnit);
  const enemies = table(raw.enemies, 'content/enemies', parseEnemy);
  const skills = table(raw.skills, 'content/skills', parseSkill);
  const ranges = table(raw.ranges, 'content/ranges', parseRange);
  const stages = table(raw.stages, 'content/stages', parseStage);
  for (const [index, unit] of [...units.values()].entries()) {
    if (!skills.has(unit.skill)) fail(`content/units[${index}].skill`, `unknown skill "${unit.skill}"`);
    if (!ranges.has(unit.range)) fail(`content/units[${index}].range`, `unknown range "${unit.range}"`);
  }
  for (const [index, stage] of [...stages.values()].entries()) {
    const path = `content/stages[${index}]`;
    for (const [slot, id] of (stage.roster ?? []).entries()) {
      if (!units.has(id)) fail(`${path}.roster[${slot}]`, `unknown unit "${id}"`);
    }
    for (const [spawnIndex, spawn] of stage.spawns.entries()) {
      const spawnPath = `${path}.spawns[${spawnIndex}]`;
      const enemy = enemies.get(spawn.enemy);
      if (!enemy) fail(`${spawnPath}.enemy`, `unknown enemy "${spawn.enemy}"`);
      const route = Object.hasOwn(stage.routes, spawn.route) ? stage.routes[spawn.route] : undefined;
      if (!route) fail(`${spawnPath}.route`, `unknown route "${spawn.route}"`);
      if (enemy.flying !== (route.flying ?? false))
        fail(`${spawnPath}.route`, 'enemy and route flying mismatch');
    }
  }
  return { units, enemies, skills, ranges, stages, unitOrder: [...units.keys()] };
}
