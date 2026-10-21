import { afterEach, describe, expect, it, vi } from 'vitest';
import { buyUnit, commitCollection, recruitUnits } from '../../src/app/collection';
import { loadSave } from '../../src/app/save';
import { mulberry32 } from '../../src/core/rng';
import { content } from '../../src/data';
import {
  initialCollection,
  isRareUnit,
  rarityFor,
  readCollection,
  recruitment,
  recruitRate,
  recruitUnitForRoll,
  unitPriceFor,
  validateRecruitment,
} from '../../src/data/recruitment';
import raw from '../../src/data/recruitment.json';

const ssrUnits = ['fox', 'redPanda', 'deer'];

afterEach(() => vi.unstubAllGlobals());

describe('희귀 모집과 영입', () => {
  it('SSR 합산 5%, 각 5/3%와 네 등급의 확률·가격이 일치한다', () => {
    expect(recruitment.pool).toHaveLength(14);
    expect(recruitment.rarities.find((r) => r.id === 'SSR')?.units).toEqual(ssrUnits);
    expect(ssrUnits.reduce((sum, id) => sum + recruitRate(id), 0)).toBeCloseTo(5, 12);
    expect(recruitment.pool.reduce((sum, id) => sum + recruitRate(id), 0)).toBeCloseTo(100, 12);
    for (const id of recruitment.pool) {
      const rarity = rarityFor(id);
      expect(recruitRate(id)).toBeCloseTo(rarity.pullPercent / rarity.units.length, 12);
      expect(unitPriceFor(id)).toBe(rarity.unitPrice);
    }
  });
  it('추첨 구간의 시작/끝은 표시 확률과 같고 축소 풀도 정규화한다', () => {
    let start = 0;
    for (const id of recruitment.pool) {
      const probability = recruitRate(id) / 100;
      expect(recruitUnitForRoll(recruitment.pool, start + probability * 0.001)).toBe(id);
      expect(recruitUnitForRoll(recruitment.pool, start + probability * 0.999)).toBe(id);
      start += probability;
    }
    expect(recruitUnitForRoll(recruitment.pool, 1 - Number.EPSILON)).toBe('snowLeopard');
    expect(recruitRate('fox', ['fox'])).toBe(100);
    expect(recruitRate('cat', ['cat', 'fox'])).toBeCloseTo(5900 / 64, 12);
    expect(recruitRate('ghost')).toBe(0);
    expect(recruitUnitForRoll([], 0)).toBeUndefined();
  });
  it('고정 시드 일반 추첨 5만 회에서 희귀 비중이 5%에 가깝고 3종이 모두 나온다', () => {
    let state = 1;
    const counts = new Map<string, number>();
    for (let i = 0; i < 50000; i++) {
      const next = mulberry32(state);
      state = next.state;
      const id = recruitUnitForRoll(recruitment.pool, next.value);
      if (!id) throw new Error('추첨 실패');
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const rare = ssrUnits.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    expect(rare / 50000).toBeGreaterThan(0.045);
    expect(rare / 50000).toBeLessThan(0.055);
    for (const id of ssrUnits) expect(counts.get(id)).toBeGreaterThan(600);
    expect((counts.get('snowLeopard') ?? 0) / 50000).toBeGreaterThan(0.008);
    expect((counts.get('snowLeopard') ?? 0) / 50000).toBeLessThan(0.012);
  });
  it.each(ssrUnits)('%s는 정확히 1800을 차감하고 보장·난수는 유지한다', (id) => {
    const state = { ...initialCollection(), money: 1800, pullsSinceNew: 7 };
    const before = structuredClone(state);
    expect(buyUnit({ ...state, money: 1799 }, id)).toEqual({ ok: false, reason: 'noMoney' });
    const result = buyUnit(state, id);
    if (!result.ok) throw new Error('영입 실패');
    expect(result.cost).toBe(1800);
    expect(result.next).toMatchObject({ money: 0, rngState: state.rngState, pullsSinceNew: 7 });
    expect(result.next.ownedUnits).toContain(id);
    expect(state).toEqual(before);
    expect(buyUnit(result.next, id)).toEqual({ ok: false, reason: 'owned' });
  });
  it('기존 10종을 보유하면 10번째 미보유 보장은 SSR·UR 중 한 명을 지급한다', () => {
    const state = { ...initialCollection(undefined, 1, true), pullsSinceNew: 9 };
    const result = recruitUnits(state, 1);
    if (!result.ok) throw new Error('모집 실패');
    expect(result.results[0]).toMatchObject({ guaranteed: true, isNew: true, refund: 0 });
    expect(isRareUnit(result.results[0]?.unitId ?? '')).toBe(true);
    expect(result.next.ownedUnits).toHaveLength(11);
    expect(result.next.pullsSinceNew).toBe(0);
    expect(result.next.money).toBe(200);
  });
  it('새/기존 저장에 희귀를 자동 지급하지 않고 영입한 희귀는 복원한다', () => {
    expect(initialCollection().ownedUnits).toHaveLength(8);
    const legacy = initialCollection(undefined, 1, true);
    expect(legacy.ownedUnits).toHaveLength(10);
    expect(legacy.ownedUnits.some(isRareUnit)).toBe(false);
    const owned = { ...legacy, ownedUnits: [...legacy.ownedUnits, 'deer'] };
    expect(readCollection(owned, content.unitOrder, 2)).toEqual(owned);
  });
  it('희귀 구매 저장 실패는 머니와 보유 목록을 함께 롤백한다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const save = loadSave();
    save.collection.ownedUnits = initialCollection().ownedUnits;
    save.collection.money = 1800;
    const before = structuredClone(save);
    expect(commitCollection(save, buyUnit(save.collection, 'fox'))).toEqual({
      ok: false,
      reason: 'saveFailed',
    });
    expect(save).toEqual(before);
  });
  it.each([
    { rarities: [] },
    { rarities: raw.rarities.slice(1) },
    { rarities: [...raw.rarities, raw.rarities[0]] },
    { starterUnits: [...raw.starterUnits, 'fox'] },
    { legacyUnits: [...raw.legacyUnits, 'snowLeopard'] },
  ])('잘못된 희귀 설정 %j를 거부한다', (patch) => {
    expect(() => validateRecruitment({ ...raw, ...patch })).toThrow();
  });
});
