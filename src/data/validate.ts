import { assert } from '../core/assert';
import type { ContentDb } from './types';
import { parseEnemy, parseRange, parseSkill, parseUnit } from './validateEntities';
import { parseStage } from './validateStage';
import { list, object } from './validationHelpers';

function uniqueMap<T extends { id: string }>(entries: T[], path: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const [index, entry] of entries.entries()) {
    assert(!result.has(entry.id), `${path}[${index}].id: duplicate id "${entry.id}"`);
    result.set(entry.id, entry);
  }
  return result;
}

export function validateContent(value: unknown): ContentDb {
  const raw = object(value, 'content');
  const units = list(raw.units, 'content/units', parseUnit);
  const enemies = list(raw.enemies, 'content/enemies', parseEnemy);
  const skills = list(raw.skills, 'content/skills', parseSkill);
  const ranges = list(raw.ranges, 'content/ranges', parseRange);
  const stages = list(raw.stages, 'content/stages', parseStage);
  const content: ContentDb = {
    units: uniqueMap(units, 'content/units'),
    enemies: uniqueMap(enemies, 'content/enemies'),
    skills: uniqueMap(skills, 'content/skills'),
    ranges: uniqueMap(ranges, 'content/ranges'),
    stages: uniqueMap(stages, 'content/stages'),
    unitOrder: units.map((unit) => unit.id),
  };
  for (const [index, unit] of units.entries()) {
    assert(content.skills.has(unit.skill), `content/units[${index}].skill: unknown skill "${unit.skill}"`);
    assert(content.ranges.has(unit.range), `content/units[${index}].range: unknown range "${unit.range}"`);
  }
  for (const [index, skill] of skills.entries())
    for (const [effectIndex, effect] of skill.effects.entries())
      if (effect.type === 'rangeOverride')
        assert(
          content.ranges.has(effect.range),
          `content/skills[${index}].effects[${effectIndex}].range: unknown range "${effect.range}"`,
        );
  for (const [index, enemy] of enemies.entries()) {
    if (!enemy.split) continue;
    const path = `content/enemies[${index}].split.enemy`;
    const child = content.enemies.get(enemy.split.enemy);
    assert(child, `${path}: unknown enemy "${enemy.split.enemy}"`);
    assert(!child.split, `${path}: split child cannot split again`);
    assert(child.flying === enemy.flying, `${path}: flying flag does not match parent`);
  }
  for (const [index, stage] of stages.entries()) {
    const path = `content/stages[${index}]`;
    for (const [rosterIndex, id] of (stage.roster ?? []).entries()) {
      assert(content.units.has(id), `${path}.roster[${rosterIndex}]: unknown unit "${id}"`);
    }
    for (const [spawnIndex, spawn] of stage.spawns.entries()) {
      const spawnPath = `${path}.spawns[${spawnIndex}]`;
      const enemy = content.enemies.get(spawn.enemy);
      const route = Object.hasOwn(stage.routes, spawn.route) ? stage.routes[spawn.route] : undefined;
      assert(enemy, `${spawnPath}.enemy: unknown enemy "${spawn.enemy}"`);
      assert(route, `${spawnPath}.route: unknown route "${spawn.route}"`);
      assert(
        enemy.flying === (route.flying ?? false),
        `${spawnPath}.route: flying flag does not match enemy`,
      );
    }
  }
  return content;
}
