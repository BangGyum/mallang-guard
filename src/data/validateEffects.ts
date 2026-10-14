import { assert } from '../core/assert';
import type { Effect } from './types';
import { integer, list, number, object, oneOf, positive, text } from './validationHelpers';

export function parseEffect(value: unknown, path: string): Effect {
  const raw = object(value, path);
  const type = text(raw.type, `${path}.type`);
  switch (type) {
    case 'statMul':
      return {
        type,
        stat: oneOf(raw.stat, `${path}.stat`, ['atk', 'atkInterval']),
        value: positive(raw.value, `${path}.value`),
      };
    case 'splash':
      return { type, radius: number(raw.radius, `${path}.radius`) };
    case 'rangeOverride':
      return { type, range: text(raw.range, `${path}.range`) };
    case 'multiTarget':
      return { type, count: integer(raw.count, `${path}.count`, 1) };
    case 'chain': {
      const damageMuls = list(raw.damageMuls, `${path}.damageMuls`, (value, itemPath) =>
        number(value, itemPath, Number.MIN_VALUE, 1),
      );
      assert(damageMuls.length > 0 && damageMuls.length <= 5, `${path}.damageMuls: requires 1 to 5 targets`);
      assert(damageMuls[0] === 1, `${path}.damageMuls[0]: first target must receive full damage`);
      assert(
        damageMuls.every((value, i) => i === 0 || value <= (damageMuls[i - 1] ?? 0)),
        `${path}.damageMuls: must not increase`,
      );
      return { type, radius: positive(raw.radius, `${path}.radius`), damageMuls };
    }
    case 'onHitSlow':
      return {
        type,
        amount: number(raw.amount, `${path}.amount`, 0, 1),
        sec: positive(raw.sec, `${path}.sec`),
      };
    case 'stunEveryNthHit':
      return { type, n: integer(raw.n, `${path}.n`, 1), sec: positive(raw.sec, `${path}.sec`) };
    case 'killBounty':
      return { type, value: integer(raw.value, `${path}.value`) };
    case 'armorPenAdd':
      return { type, value: integer(raw.value, `${path}.value`) };
    case 'hasteAura':
      return { type, value: number(raw.value, `${path}.value`, Number.MIN_VALUE, 1) };
    case 'pulseDamage':
      return {
        type,
        count: integer(raw.count, `${path}.count`, 1),
        intervalSec: positive(raw.intervalSec, `${path}.intervalSec`),
        atkMul: positive(raw.atkMul, `${path}.atkMul`),
        damageType: oneOf(raw.damageType, `${path}.damageType`, ['physical', 'magic']),
      };
    case 'slowAura':
      return { type, amount: number(raw.amount, `${path}.amount`, 0, 1) };
    case 'pushback':
      return { type, tiles: number(raw.tiles, `${path}.tiles`) };
    default:
      throw new Error(`${path}.type: unknown effect "${type}"`);
  }
}
