import { afterEach, describe, expect, it, vi } from 'vitest';
import { buyUnit, commitCollection, recruitUnits } from '../../src/app/collection';
import { loadSave } from '../../src/app/save';
import { mulberry32 } from '../../src/core/rng';
import {
  initialCollection,
  rarityFor,
  readCollection,
  recruitment,
  recruitRate,
  recruitUnitForRoll,
  validateRecruitment,
} from '../../src/data/recruitment';
import raw from '../../src/data/recruitment.json';

afterEach(() => vi.unstubAllGlobals());

describe('R·SR·SSR·UR 획득 계약', () => {
  it.each([
    ['R', 59, 600],
    ['SR', 35, 600],
    ['SSR', 5, 1800],
    ['UR', 1, 3600],
  ] as const)('%s의 합산 확률 %s와 가격 %s는 실제 추첨과 일치한다', (id, percent, price) => {
    const rarity = recruitment.rarities.find((r) => r.id === id);
    expect(rarity).toBeDefined();
    expect(rarity?.units.reduce((sum, unit) => sum + recruitRate(unit), 0)).toBeCloseTo(percent, 12);
    for (const unit of rarity?.units ?? []) expect(rarityFor(unit).unitPrice).toBe(price);
  });
  it('UR은 마지막 1% 구간과 단독 축소 풀에서 나온다', () => {
    expect(recruitRate('snowLeopard')).toBe(1);
    expect(recruitUnitForRoll(recruitment.pool, 0.989999)).toBe('deer');
    expect(recruitUnitForRoll(recruitment.pool, 0.99)).toBe('snowLeopard');
    expect(recruitUnitForRoll(['snowLeopard'], 0)).toBe('snowLeopard');
    expect(recruitRate('snowLeopard', ['snowLeopard'])).toBe(100);
  });
  it('UR만 미보유이면 10번째 보장으로 영입하고 난수는 한 번만 진행한다', () => {
    const state = {
      ...initialCollection(),
      ownedUnits: recruitment.pool.filter((id) => id !== 'snowLeopard'),
      pullsSinceNew: 9,
    };
    const result = recruitUnits(state, 1);
    if (!result.ok) throw new Error('UR 보장 실패');
    expect(result.results).toEqual([{ unitId: 'snowLeopard', isNew: true, guaranteed: true, refund: 0 }]);
    expect(result.next.pullsSinceNew).toBe(0);
    expect(result.next.money).toBe(200);
    expect(result.next.rngState).toBe(mulberry32(state.rngState).state);
    expect(result).toEqual(recruitUnits(state, 1));
  });
  it('UR 직접 영입은 정확히 3600을 차감하고 기존 기록과 저장 상태를 보존한다', () => {
    const state = { ...initialCollection(undefined, 77, true), money: 3600, pullsSinceNew: 6 };
    const result = buyUnit(state, 'snowLeopard');
    if (!result.ok) throw new Error('UR 영입 실패');
    expect(result.next).toMatchObject({ money: 0, rngState: 77, pullsSinceNew: 6 });
    expect(result.next.ownedUnits).toContain('snowLeopard');
    expect(readCollection(result.next, recruitment.pool, 1)).toEqual(result.next);
    expect(buyUnit({ ...state, money: 3599 }, 'snowLeopard')).toEqual({ ok: false, reason: 'noMoney' });
    expect(state.ownedUnits).toHaveLength(10);
  });
  it('UR 구매 저장 실패도 머니·보장·난수·기록을 함께 롤백한다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const save = loadSave();
    save.collection.ownedUnits = initialCollection().ownedUnits;
    save.collection.money = 3600;
    save.stages['stage-1'] = { cleared: true, bestLife: 3 };
    const before = structuredClone(save);
    expect(commitCollection(save, buyUnit(save.collection, 'snowLeopard'))).toEqual({
      ok: false,
      reason: 'saveFailed',
    });
    expect(save).toEqual(before);
  });
  it.each([
    { pullPercent: 0 },
    { pullPercent: 1.5 },
    { pullPercent: 2 },
    { unitPrice: 0 },
    { unitPrice: 0.5 },
    { unitPrice: raw.maxMoney + 1 },
    { units: [] },
    { units: ['ghost'] },
    { units: ['fox'] },
    { units: ['snowLeopard', 'snowLeopard'] },
    { id: 'legend' },
  ])('잘못된 UR 설정 %j를 거부한다', (patch) => {
    const rarities = raw.rarities.map((r) => (r.id === 'UR' ? { ...r, ...patch } : r));
    expect(() => validateRecruitment({ ...raw, rarities })).toThrow('recruitment.rarities');
  });
});
