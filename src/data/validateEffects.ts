import type { Effect } from './types';
import { integer, number, object, oneOf, positive, text } from './validationHelpers';

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
