import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSave, storeSave } from '../../src/app/save';
import { initialCollection, recruitment } from '../../src/data/recruitment';

const testing = recruitment.unlockAllForTesting;
beforeEach(() => {
  recruitment.unlockAllForTesting = false;
});
afterEach(() => {
  recruitment.unlockAllForTesting = testing;
  vi.unstubAllGlobals();
});
function storage(raw: unknown) {
  let value = JSON.stringify(raw);
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  });
}
describe('컬렉션 저장과 이전 기록 호환', () => {
  it('이전 v1 저장은 기존 10종을 보존하고 설정·별을 유지한다', () => {
    storage({
      version: 1,
      settings: { speed: 2, quality: 'low' },
      stages: { 'stage-7': { cleared: true, bestLife: 3 } },
    });
    const save = loadSave();
    expect(save.collection.ownedUnits).toEqual(recruitment.legacyUnits);
    expect(save.settings).toMatchObject({ speed: 2, quality: 'low' });
    expect(save.stages['stage-7']).toEqual({ cleared: true, bestLife: 3 });
    expect(storeSave(save)).toBe(true);
    expect(loadSave()).toEqual(save);
  });
  it('머니·보유 목록·보장·난수는 설정 저장 후에도 그대로 복원한다', () => {
    const collection = {
      ...initialCollection(),
      money: 1234,
      ownedUnits: [...initialCollection().ownedUnits, 'owl'],
      pullsSinceNew: 8,
      rngState: 0,
    };
    storage({ version: 1, collection });
    const save = loadSave();
    save.settings.speed = 2;
    storeSave(save);
    expect(loadSave().collection).toEqual(collection);
  });
  it('잘못된 잔액·횟수·난수는 기본값, 중복/알 수 없는 ID는 제외한다', () => {
    storage({
      version: 1,
      collection: { money: -1, ownedUnits: ['owl', 'owl', 'unknown', 99], pullsSinceNew: 1.5, rngState: -3 },
    });
    const state = loadSave().collection;
    expect(state).toEqual({ ...initialCollection(), ownedUnits: [...initialCollection().ownedUnits, 'owl'] });
  });
  it('상한을 넘는 유효한 정수는 제한하고 현재 콘텐츠에 없는 보유 ID를 제외한다', () => {
    storage({
      version: 1,
      collection: {
        money: Number.MAX_SAFE_INTEGER,
        ownedUnits: ['owl'],
        pullsSinceNew: 50,
        rngState: 0xffffffff,
      },
    });
    expect(loadSave(['squirrel'], 25).collection).toEqual({
      money: recruitment.maxMoney,
      ownedUnits: ['squirrel'],
      pullsSinceNew: 9,
      rngState: 0xffffffff,
    });
  });
  it.each([null, [], 'broken'])('깨진 컬렉션 %s를 기존 유저 전체 보유로 바꾸지 않는다', (collection) => {
    storage({ version: 1, collection });
    expect(loadSave().collection).toEqual(initialCollection());
  });
});
