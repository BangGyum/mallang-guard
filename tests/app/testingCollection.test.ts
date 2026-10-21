import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSave, storeSave } from '../../src/app/save';
import { content } from '../../src/data';
import { initialCollection, recruitment } from '../../src/data/recruitment';

const testing = recruitment.unlockAllForTesting;
let value: string | null;
beforeEach(() => {
  recruitment.unlockAllForTesting = true;
  value = null;
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  });
});
afterEach(() => {
  recruitment.unlockAllForTesting = testing;
  vi.unstubAllGlobals();
});

describe('테스트 기간 전원 지급', () => {
  it('현재 기본 설정으로 신규 저장에 SSR·UR 포함 14종을 지급한다', () => {
    expect(testing).toBe(true);
    const save = loadSave(content.unitOrder, 17);
    expect(save.collection).toEqual({ ...initialCollection(undefined, 17), ownedUnits: recruitment.pool });
    expect(save.collection.ownedUnits).toHaveLength(14);
    expect(storeSave(save)).toBe(true);
    expect(loadSave()).toEqual(save);
  });
  it('이미 영입한 친구와 머니·보장·난수·설정·별을 유지하며 부족한 친구만 더한다', () => {
    const profile = {
      version: 1,
      settings: { speed: 2, quality: 'low', sfxVolume: 0.3, reducedMotion: true },
      stages: { 'stage-7': { cleared: true, bestLife: 3 } },
      collection: {
        money: 1234,
        ownedUnits: [...recruitment.starterUnits, 'deer', 'deer', 'unknown'],
        pullsSinceNew: 8,
        rngState: 0,
      },
    };
    value = JSON.stringify(profile);
    const save = loadSave();
    expect(save.settings).toEqual(profile.settings);
    expect(save.stages).toEqual(profile.stages);
    expect(save.collection).toMatchObject({ money: 1234, pullsSinceNew: 8, rngState: 0 });
    expect(new Set(save.collection.ownedUnits)).toEqual(new Set(recruitment.pool));
    expect(save.collection.ownedUnits).toHaveLength(14);
    expect(save.collection.ownedUnits.slice(0, 9)).toEqual([...recruitment.starterUnits, 'deer']);
    expect(storeSave(save)).toBe(true);
    expect(loadSave()).toEqual(save);
  });
  it('상점 도입 전 v1 저장도 전원 지급하며 기록을 유지한다', () => {
    value = JSON.stringify({ version: 1, stages: { 'stage-3': { cleared: true, bestLife: 2 } } });
    const save = loadSave();
    expect(save.collection.ownedUnits).toEqual(recruitment.pool);
    expect(save.stages['stage-3']).toEqual({ cleared: true, bestLife: 2 });
  });
  it('현재 콘텐츠에 있는 친구만 지급하고 반환 목록을 공유하지 않는다', () => {
    const first = loadSave(['squirrel', 'snowLeopard', 'snowLeopard']);
    expect(first.collection.ownedUnits).toEqual(['squirrel', 'snowLeopard']);
    first.collection.ownedUnits.pop();
    expect(loadSave(['squirrel', 'snowLeopard']).collection.ownedUnits).toHaveLength(2);
  });
  it('저장소 사용이 막혀도 현재 세션에서 모든 친구를 사용할 수 있다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const save = loadSave();
    expect(save.collection.ownedUnits).toEqual(recruitment.pool);
    expect(storeSave(save)).toBe(false);
  });
  it('테스트 지급을 끄면 신규는 기본 8종이며 이미 받은 친구는 회수하지 않는다', () => {
    const save = loadSave();
    recruitment.unlockAllForTesting = false;
    expect(loadSave().collection.ownedUnits).toEqual(recruitment.starterUnits);
    expect(storeSave(save)).toBe(true);
    expect(loadSave().collection.ownedUnits).toEqual(recruitment.pool);
  });
});
