import { mulberry32 } from '../core/rng';
import { type CollectionState, type RecruitResult, recruitment, type ShopResult } from '../data/recruitment';
import type { ContentDb } from '../data/types';
import { type SaveData, storeSave } from './save';

export type CollectionChange =
  | Extract<ShopResult, { ok: false }>
  | (Extract<ShopResult, { ok: true }> & { next: CollectionState });

export function recruitUnits(
  state: Readonly<CollectionState>,
  count: 1 | 10,
  available: readonly string[] = recruitment.pool,
): CollectionChange {
  const cost = recruitment.pullCost * count;
  if (state.money < cost) return { ok: false, reason: 'noMoney' };
  const pool = recruitment.pool.filter((id) => available.includes(id));
  if (pool.length === 0) return { ok: false, reason: 'unknownUnit' };
  const next = { ...state, money: state.money - cost, ownedUnits: [...state.ownedUnits] };
  const results: RecruitResult[] = [];
  let refund = 0;
  for (let index = 0; index < count; index++) {
    const missing = pool.filter((id) => !next.ownedUnits.includes(id));
    const guaranteed = missing.length > 0 && next.pullsSinceNew >= recruitment.guaranteeAfter - 1;
    const candidates = guaranteed ? missing : pool;
    const random = mulberry32(next.rngState);
    next.rngState = random.state;
    const unitId = candidates[Math.floor(random.value * candidates.length)];
    if (!unitId) return { ok: false, reason: 'unknownUnit' };
    const isNew = !next.ownedUnits.includes(unitId);
    const back = isNew ? 0 : recruitment.duplicateRefund;
    if (isNew) next.ownedUnits.push(unitId);
    next.pullsSinceNew = isNew || missing.length === 0 ? 0 : next.pullsSinceNew + 1;
    refund += back;
    results.push({ unitId, isNew, guaranteed, refund: back });
  }
  next.money = Math.min(recruitment.maxMoney, next.money + refund);
  return { ok: true, next, results, cost, refund };
}

export function buyUnit(
  state: Readonly<CollectionState>,
  unitId: string,
  available: readonly string[] = recruitment.pool,
): CollectionChange {
  if (!recruitment.pool.includes(unitId) || !available.includes(unitId))
    return { ok: false, reason: 'unknownUnit' };
  if (state.ownedUnits.includes(unitId)) return { ok: false, reason: 'owned' };
  if (state.money < recruitment.unitPrice) return { ok: false, reason: 'noMoney' };
  return {
    ok: true,
    next: { ...state, money: state.money - recruitment.unitPrice, ownedUnits: [...state.ownedUnits, unitId] },
    results: [{ unitId, isNew: true, guaranteed: false, refund: 0 }],
    cost: recruitment.unitPrice,
    refund: 0,
  };
}

export function commitCollection(save: SaveData, change: CollectionChange): ShopResult {
  if (!change.ok) return change;
  if (!storeSave({ ...save, collection: change.next })) return { ok: false, reason: 'saveFailed' };
  save.collection = change.next;
  return { ok: true, results: change.results, cost: change.cost, refund: change.refund };
}

export function battleMoney(
  stageId: string,
  won: boolean,
  kills: number,
  stars: number,
  firstClear: boolean,
): number {
  return won
    ? (recruitment.clearRewards[stageId] ?? 0) +
        Math.min(3, Math.max(0, stars)) * recruitment.starBonus +
        (firstClear ? recruitment.firstClearBonus : 0)
    : Math.min(recruitment.defeatMax, Math.max(0, kills) * recruitment.defeatPerKill);
}

export function ownedBattleContent(content: ContentDb, stageId: string, owned: readonly string[]): ContentDb {
  const stage = content.stages.get(stageId);
  if (!stage) return content;
  const roster = (stage.roster ?? content.unitOrder).filter((id) => owned.includes(id));
  return { ...content, stages: new Map(content.stages).set(stageId, { ...stage, roster }) };
}
