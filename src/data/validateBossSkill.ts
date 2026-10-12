import { assert } from '../core/assert';
import type { BossSkillDef } from './types';
import { integer, number, object, oneOf, positive, text } from './validationHelpers';

export function parseBossSkill(value: unknown, path: string): BossSkillDef {
  const raw = object(value, path);
  const entry = object(raw.effect, `${path}.effect`);
  const effectPath = `${path}.effect`;
  const type = oneOf(entry.type, `${effectPath}.type`, ['rush', 'shield', 'heal', 'summon', 'disrupt']);
  let effect: BossSkillDef['effect'];
  switch (type) {
    case 'rush':
      effect = {
        type,
        durationSec: positive(entry.durationSec, `${effectPath}.durationSec`),
        speedMul: number(entry.speedMul, `${effectPath}.speedMul`, 1),
      };
      break;
    case 'shield':
      effect = { type, amount: positive(entry.amount, `${effectPath}.amount`) };
      break;
    case 'heal':
      effect = {
        type,
        amount: positive(entry.amount, `${effectPath}.amount`),
        range: positive(entry.range, `${effectPath}.range`),
        targets: integer(entry.targets, `${effectPath}.targets`, 1),
      };
      break;
    case 'summon':
      effect = {
        type,
        enemy: text(entry.enemy, `${effectPath}.enemy`),
        count: integer(entry.count, `${effectPath}.count`, 1),
        maxCasts: integer(entry.maxCasts, `${effectPath}.maxCasts`, 1),
      };
      break;
    case 'disrupt':
      effect = {
        type,
        range: positive(entry.range, `${effectPath}.range`),
        durationSec: positive(entry.durationSec, `${effectPath}.durationSec`),
        atkIntervalMul: number(entry.atkIntervalMul, `${effectPath}.atkIntervalMul`, 1),
        targets: integer(entry.targets, `${effectPath}.targets`, 1),
      };
      break;
  }
  const skill: BossSkillDef = {
    name: text(raw.name, `${path}.name`),
    description: text(raw.description, `${path}.description`),
    firstCastSec: positive(raw.firstCastSec, `${path}.firstCastSec`),
    intervalSec: positive(raw.intervalSec, `${path}.intervalSec`),
    windupSec: positive(raw.windupSec, `${path}.windupSec`),
    effect,
  };
  assert(skill.windupSec < skill.intervalSec, `${path}.windupSec: must be shorter than interval`);
  if (effect.type === 'rush')
    assert(effect.durationSec <= skill.intervalSec, `${path}.effect.durationSec: exceeds interval`);
  return skill;
}
