import { assert } from '../core/assert';
import raw from './recruitment.json';
import type { ContentDb } from './types';
import { integer, list, object, text } from './validationHelpers';

export interface CollectionState {
  money: number;
  ownedUnits: string[];
  pullsSinceNew: number;
  rngState: number;
}

export interface RecruitmentRules {
  startMoney: number;
  maxMoney: number;
  pullCost: number;
  duplicateRefund: number;
  guaranteeAfter: number;
  unitPrice: number;
  rareUnitPrice: number;
  rarePullPercent: number;
  rareUnits: string[];
  starterUnits: string[];
  legacyUnits: string[];
  pool: string[];
  firstClearBonus: number;
  starBonus: number;
  defeatPerKill: number;
  defeatMax: number;
  clearRewards: Record<string, number>;
}

export interface RecruitResult {
  unitId: string;
  isNew: boolean;
  guaranteed: boolean;
  refund: number;
}

export type ShopResult =
  | { ok: true; results: RecruitResult[]; cost: number; refund: number }
  | { ok: false; reason: 'noMoney' | 'owned' | 'unknownUnit' | 'saveFailed' };

export interface MoneyReward {
  amount: number;
  balance: number;
  firstClear: boolean;
  saved: boolean;
}

export function validateRecruitment(value: unknown): RecruitmentRules {
  const entry = object(value, 'recruitment');
  const rules: RecruitmentRules = {
    startMoney: integer(entry.startMoney, 'recruitment.startMoney'),
    maxMoney: integer(entry.maxMoney, 'recruitment.maxMoney', 1),
    pullCost: integer(entry.pullCost, 'recruitment.pullCost', 1),
    duplicateRefund: integer(entry.duplicateRefund, 'recruitment.duplicateRefund'),
    guaranteeAfter: integer(entry.guaranteeAfter, 'recruitment.guaranteeAfter', 1),
    unitPrice: integer(entry.unitPrice, 'recruitment.unitPrice', 1),
    rareUnitPrice: integer(entry.rareUnitPrice, 'recruitment.rareUnitPrice', 1),
    rarePullPercent: integer(entry.rarePullPercent, 'recruitment.rarePullPercent', 1),
    rareUnits: list(entry.rareUnits, 'recruitment.rareUnits', text),
    starterUnits: list(entry.starterUnits, 'recruitment.starterUnits', text),
    legacyUnits: list(entry.legacyUnits, 'recruitment.legacyUnits', text),
    pool: list(entry.pool, 'recruitment.pool', text),
    firstClearBonus: integer(entry.firstClearBonus, 'recruitment.firstClearBonus'),
    starBonus: integer(entry.starBonus, 'recruitment.starBonus'),
    defeatPerKill: integer(entry.defeatPerKill, 'recruitment.defeatPerKill'),
    defeatMax: integer(entry.defeatMax, 'recruitment.defeatMax'),
    clearRewards: {},
  };
  assert(rules.pool.length > 0, 'recruitment.pool: must not be empty');
  for (const field of ['starterUnits', 'legacyUnits', 'pool', 'rareUnits'] as const)
    assert(new Set(rules[field]).size === rules[field].length, `recruitment.${field}: duplicate unit`);
  for (const id of [...rules.starterUnits, ...rules.legacyUnits, ...rules.rareUnits])
    assert(rules.pool.includes(id), `recruitment: unknown unit ${id}`);
  assert(rules.startMoney <= rules.maxMoney, 'recruitment.startMoney: exceeds maxMoney');
  assert(rules.pullCost * 10 <= rules.maxMoney, 'recruitment.pullCost: ten pulls exceed maxMoney');
  assert(rules.unitPrice <= rules.maxMoney, 'recruitment.unitPrice: exceeds maxMoney');
  assert(rules.rareUnitPrice <= rules.maxMoney, 'recruitment.rareUnitPrice: exceeds maxMoney');
  assert(rules.rarePullPercent < 100, 'recruitment.rarePullPercent: must be below 100');
  assert(
    rules.rareUnits.length > 0 && rules.rareUnits.length < rules.pool.length,
    'recruitment.rareUnits: requires both rarities',
  );
  assert(
    ![...rules.starterUnits, ...rules.legacyUnits].some((id) => rules.rareUnits.includes(id)),
    'recruitment.rareUnits: cannot be granted by initial or legacy migration',
  );
  assert(rules.maxMoney <= Number.MAX_SAFE_INTEGER, 'recruitment.maxMoney: exceeds safe integer');
  assert(rules.duplicateRefund < rules.pullCost, 'recruitment.duplicateRefund: must be below pullCost');
  const rewards = object(entry.clearRewards, 'recruitment.clearRewards');
  for (const [id, amount] of Object.entries(rewards))
    rules.clearRewards[id] = integer(amount, `recruitment.clearRewards.${id}`);
  return rules;
}

export const recruitment = validateRecruitment(raw);

export function isRareUnit(id: string): boolean {
  return recruitment.rareUnits.includes(id);
}

export function unitPriceFor(id: string): number {
  return isRareUnit(id) ? recruitment.rareUnitPrice : recruitment.unitPrice;
}

export function recruitRate(id: string, pool: readonly string[] = recruitment.pool): number {
  if (!pool.includes(id)) return 0;
  const rareCount = pool.filter(isRareUnit).length;
  const commonCount = pool.length - rareCount;
  const share =
    rareCount === 0 || commonCount === 0
      ? 100
      : isRareUnit(id)
        ? recruitment.rarePullPercent
        : 100 - recruitment.rarePullPercent;
  return share / (isRareUnit(id) ? rareCount : commonCount);
}

export function recruitUnitForRoll(pool: readonly string[], value: number): string | undefined {
  let cumulative = 0;
  for (const id of pool) {
    cumulative += recruitRate(id, pool) / 100;
    if (value < cumulative) return id;
  }
  return pool[pool.length - 1];
}

export function validateRecruitmentReferences(rules: RecruitmentRules, content: ContentDb): void {
  for (const id of rules.pool) assert(content.units.has(id), `recruitment.pool: unknown unit ${id}`);
  for (const id of Object.keys(rules.clearRewards))
    assert(content.stages.has(id), `recruitment.clearRewards: unknown stage ${id}`);
  for (const id of content.stages.keys())
    assert(rules.clearRewards[id] !== undefined, `recruitment.clearRewards: missing stage ${id}`);
}

export function initialCollection(
  unitIds: readonly string[] = recruitment.pool,
  seed = 1,
  legacy = false,
): CollectionState {
  return {
    money: recruitment.startMoney,
    ownedUnits: (legacy ? recruitment.legacyUnits : recruitment.starterUnits).filter((id) =>
      unitIds.includes(id),
    ),
    pullsSinceNew: 0,
    rngState: seed >>> 0,
  };
}

export function readCollection(value: unknown, unitIds: readonly string[], seed: number): CollectionState {
  const state = initialCollection(unitIds, seed);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return state;
  const raw = value as Record<string, unknown>;
  if (typeof raw.money === 'number' && Number.isSafeInteger(raw.money) && raw.money >= 0)
    state.money = Math.min(raw.money, recruitment.maxMoney);
  if (Array.isArray(raw.ownedUnits))
    state.ownedUnits = [
      ...new Set([
        ...state.ownedUnits,
        ...raw.ownedUnits.filter((id): id is string => typeof id === 'string' && unitIds.includes(id)),
      ]),
    ];
  if (
    typeof raw.pullsSinceNew === 'number' &&
    Number.isSafeInteger(raw.pullsSinceNew) &&
    raw.pullsSinceNew >= 0
  )
    state.pullsSinceNew = Math.min(raw.pullsSinceNew, recruitment.guaranteeAfter - 1);
  if (
    typeof raw.rngState === 'number' &&
    Number.isInteger(raw.rngState) &&
    raw.rngState >= 0 &&
    raw.rngState <= 0xffffffff
  )
    state.rngState = raw.rngState;
  return state;
}
