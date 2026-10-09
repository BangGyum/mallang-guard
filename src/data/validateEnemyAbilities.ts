import { assert } from '../core/assert';
import type { EnemyDef } from './types';
import { integer, number, object, positive, text } from './validationHelpers';

export function parseEnemyAbilities(raw: Record<string, unknown>, path: string): Partial<EnemyDef> {
  const result: Partial<EnemyDef> = {};
  if (raw.shieldHp !== undefined) result.shieldHp = positive(raw.shieldHp, `${path}.shieldHp`);
  if (raw.rush !== undefined) {
    const rush = object(raw.rush, `${path}.rush`);
    result.rush = {
      intervalSec: positive(rush.intervalSec, `${path}.rush.intervalSec`),
      durationSec: positive(rush.durationSec, `${path}.rush.durationSec`),
      speedMul: number(rush.speedMul, `${path}.rush.speedMul`, 1),
    };
    assert(result.rush.durationSec <= result.rush.intervalSec, `${path}.rush: duration exceeds interval`);
  }
  if (raw.regenerate !== undefined) {
    const regen = object(raw.regenerate, `${path}.regenerate`);
    result.regenerate = {
      intervalSec: positive(regen.intervalSec, `${path}.regenerate.intervalSec`),
      amount: positive(regen.amount, `${path}.regenerate.amount`),
    };
  }
  if (raw.heal !== undefined) {
    const heal = object(raw.heal, `${path}.heal`);
    result.heal = {
      intervalSec: positive(heal.intervalSec, `${path}.heal.intervalSec`),
      amount: positive(heal.amount, `${path}.heal.amount`),
      range: positive(heal.range, `${path}.heal.range`),
    };
  }
  if (raw.haste !== undefined) {
    const haste = object(raw.haste, `${path}.haste`);
    result.haste = {
      range: positive(haste.range, `${path}.haste.range`),
      speedMul: number(haste.speedMul, `${path}.haste.speedMul`, 1),
    };
  }
  if (raw.summon !== undefined) {
    const summon = object(raw.summon, `${path}.summon`);
    result.summon = {
      intervalSec: positive(summon.intervalSec, `${path}.summon.intervalSec`),
      enemy: text(summon.enemy, `${path}.summon.enemy`),
      count: integer(summon.count, `${path}.summon.count`, 1),
      maxCasts: integer(summon.maxCasts, `${path}.summon.maxCasts`, 1),
    };
  }
  return result;
}
