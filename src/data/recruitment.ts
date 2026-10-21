import { assert } from '../core/assert';
import raw from './recruitment.json';
import type { ContentDb } from './types';
import { bool, integer, list, object, oneOf, text } from './validationHelpers';

export const RARITY_IDS = ['R', 'SR', 'SSR', 'UR'] as const;
export type RarityId = (typeof RARITY_IDS)[number];
export interface RecruitmentRarity {
  id: RarityId;
  pullPercent: number;
  unitPrice: number;
  units: string[];
}

export interface CollectionState {
  money: number;
  ownedUnits: string[];
  pullsSinceNew: number;
  rngState: number;
}

export interface RecruitmentRules {
  unlockAllForTesting: boolean;
  startMoney: number;
  maxMoney: number;
  pullCost: number;
  duplicateRefund: number;
  guaranteeAfter: number;
  rarities: RecruitmentRarity[];
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
    unlockAllForTesting: bool(entry.unlockAllForTesting ?? false, 'recruitment.unlockAllForTesting'),
    startMoney: integer(entry.startMoney, 'recruitment.startMoney'),
    maxMoney: integer(entry.maxMoney, 'recruitment.maxMoney', 1),
    pullCost: integer(entry.pullCost, 'recruitment.pullCost', 1),
    duplicateRefund: integer(entry.duplicateRefund, 'recruitment.duplicateRefund'),
    guaranteeAfter: integer(entry.guaranteeAfter, 'recruitment.guaranteeAfter', 1),
    rarities: list(entry.rarities, 'recruitment.rarities', (value, path) => {
      const rarity = object(value, path);
      return {
        id: oneOf(rarity.id, `${path}.id`, RARITY_IDS),
        pullPercent: integer(rarity.pullPercent, `${path}.pullPercent`, 1),
        unitPrice: integer(rarity.unitPrice, `${path}.unitPrice`, 1),
        units: list(rarity.units, `${path}.units`, text),
      };
    }),
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
  for (const field of ['starterUnits', 'legacyUnits', 'pool'] as const)
    assert(new Set(rules[field]).size === rules[field].length, `recruitment.${field}: duplicate unit`);
  for (const id of [...rules.starterUnits, ...rules.legacyUnits])
    assert(rules.pool.includes(id), `recruitment: unknown unit ${id}`);
  assert(rules.startMoney <= rules.maxMoney, 'recruitment.startMoney: exceeds maxMoney');
  assert(rules.pullCost * 10 <= rules.maxMoney, 'recruitment.pullCost: ten pulls exceed maxMoney');
  assert(
    rules.rarities.length === RARITY_IDS.length &&
      new Set(rules.rarities.map((r) => r.id)).size === RARITY_IDS.length,
    'recruitment.rarities: requires each rarity exactly once',
  );
  assert(
    rules.rarities.reduce((sum, r) => sum + r.pullPercent, 0) === 100,
    'recruitment.rarities: rates must total 100',
  );
  const ranked = rules.rarities.flatMap((r) => r.units);
  assert(new Set(ranked).size === ranked.length, 'recruitment.rarities: duplicate unit');
  assert(
    ranked.length === rules.pool.length && ranked.every((id) => rules.pool.includes(id)),
    'recruitment.rarities: must cover pool exactly',
  );
  for (const rarity of rules.rarities) {
    assert(rarity.units.length > 0, `recruitment.rarities.${rarity.id}.units: must not be empty`);
    assert(
      rarity.unitPrice <= rules.maxMoney,
      `recruitment.rarities.${rarity.id}.unitPrice: exceeds maxMoney`,
    );
  }
  assert(
    !rules.rarities
      .filter((r) => r.id === 'SSR' || r.id === 'UR')
      .some((r) => [...rules.starterUnits, ...rules.legacyUnits].some((id) => r.units.includes(id))),
    'recruitment.rarities: SSR/UR cannot be granted by initial or legacy migration',
  );
  assert(rules.maxMoney <= Number.MAX_SAFE_INTEGER, 'recruitment.maxMoney: exceeds safe integer');
  assert(rules.duplicateRefund < rules.pullCost, 'recruitment.duplicateRefund: must be below pullCost');
  const rewards = object(entry.clearRewards, 'recruitment.clearRewards');
  for (const [id, amount] of Object.entries(rewards))
    rules.clearRewards[id] = integer(amount, `recruitment.clearRewards.${id}`);
  return rules;
}

export const recruitment = validateRecruitment(raw);

export function rarityFor(id: string): RecruitmentRarity {
  const rarity = recruitment.rarities.find((rarity) => rarity.units.includes(id));
  assert(rarity, `recruitment.rarities: unknown unit ${id}`);
  return rarity;
}

export function isRareUnit(id: string): boolean {
  return recruitment.rarities.some((r) => (r.id === 'SSR' || r.id === 'UR') && r.units.includes(id));
}

export function unitPriceFor(id: string): number {
  return rarityFor(id).unitPrice;
}

export function recruitRate(id: string, pool: readonly string[] = recruitment.pool): number {
  if (!pool.includes(id)) return 0;
  const available = recruitment.rarities.map((r) => ({
    ...r,
    count: r.units.filter((id) => pool.includes(id)).length,
  }));
  const rarity = available.find((r) => r.units.includes(id));
  if (!rarity || rarity.count === 0) return 0;
  const total = available.filter((r) => r.count > 0).reduce((sum, r) => sum + r.pullPercent, 0);
  return ((rarity.pullPercent / total) * 100) / rarity.count;
}

export function recruitUnitForRoll(pool: readonly string[], value: number): string | undefined {
  let cumulative = 0;
  for (const id of pool) {
    cumulative += recruitRate(id, pool) / 100;
    // 분수 확률의 누적 오차가 등급 경계(예: 99%)를 넘지 않게 합니다.
    if (value < Number(cumulative.toPrecision(15))) return id;
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
