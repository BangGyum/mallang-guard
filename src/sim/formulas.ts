import type { DamageType } from '../data/types';
import { MIN_DAMAGE_RATIO } from './constants';

export function damageAmount(type: DamageType, atk: number, def: number, res: number, armorPen = 0): number {
  if (type === 'true') return atk;
  const amount = type === 'physical' ? atk - Math.max(0, def - armorPen) : atk * (1 - res / 100);
  return Math.max(amount, atk * MIN_DAMAGE_RATIO);
}
