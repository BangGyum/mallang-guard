import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  battleMoney,
  buyUnit,
  commitCollection,
  ownedBattleContent,
  recruitUnits,
} from '../../src/app/collection';
import { loadSave } from '../../src/app/save';
import { content } from '../../src/data';
import { initialCollection, recruitment } from '../../src/data/recruitment';
import { createBattle } from '../../src/sim/battle';
import { runScenario, type Scenario } from '../helpers';

const clears = import.meta.glob<Scenario>('../scenarios/stage-?-clear.json', {
  eager: true,
  import: 'default',
});

afterEach(() => vi.unstubAllGlobals());

describe('머니·친구 모집', () => {
  it('새 플레이어는 기본 8종으로 시작하고 입력 상태를 수정하지 않는다', () => {
    const state = initialCollection();
    const before = structuredClone(state);
    expect(state.ownedUnits).toHaveLength(8);
    const result = recruitUnits(state, 1);
    expect(state).toEqual(before);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('모집 실패');
    expect(result.next.money).toBe(state.money - result.cost + result.refund);
    expect(result.next.rngState).not.toBe(state.rngState);
  });
  it('같은 난수 상태의 모집은 결과와 다음 상태가 같다', () => {
    const state = { ...initialCollection(), money: 1000 };
    expect(recruitUnits(state, 10)).toEqual(recruitUnits(state, 10));
  });
  it('잔액이 부족하면 난수·보장·보유 상태를 소비하지 않는다', () => {
    const state = { ...initialCollection(), money: 99, pullsSinceNew: 9 };
    const before = structuredClone(state);
    expect(recruitUnits(state, 1)).toEqual({ ok: false, reason: 'noMoney' });
    expect(state).toEqual(before);
  });
  it('10회 모집은 환급을 예상하지 않고 비용 1000을 먼저 확인한다', () => {
    const state = { ...initialCollection(undefined, 1, true), money: 999 };
    expect(recruitUnits(state, 10)).toEqual({ ok: false, reason: 'noMoney' });
  });
  it('중복은 한 번에 30머니를 환급하고 보유 목록을 중복 추가하지 않는다', () => {
    const state = { ...initialCollection(undefined, 1, true), ownedUnits: [...recruitment.pool] };
    const result = recruitUnits(state, 1);
    if (!result.ok) throw new Error('모집 실패');
    expect(result.results[0]).toMatchObject({ isNew: false, refund: 30, guaranteed: false });
    expect(result.next.money).toBe(230);
    expect(result.next.ownedUnits).toEqual(state.ownedUnits);
    expect(result.next.pullsSinceNew).toBe(0);
  });
  it('10번째 중복 경계에서는 미보유 친구를 확정 지급하고 카운터를 초기화한다', () => {
    const state = { ...initialCollection(), pullsSinceNew: 9 };
    const result = recruitUnits(state, 1);
    if (!result.ok) throw new Error('모집 실패');
    expect(result.results[0]).toMatchObject({ isNew: true, guaranteed: true, refund: 0 });
    expect(result.next.ownedUnits).toHaveLength(9);
    expect(result.next.pullsSinceNew).toBe(0);
    expect(result.next.money).toBe(200);
  });
  it.each([0, 1, 4, 25, 180])('시드 %s에서도 10회 이내에 새 친구를 지급하고 잔액을 보존한다', (seed) => {
    const state = { ...initialCollection(undefined, seed), money: 1000 };
    const result = recruitUnits(state, 10);
    if (!result.ok) throw new Error('모집 실패');
    expect(result.results).toHaveLength(10);
    expect(result.results.some((entry) => entry.isNew)).toBe(true);
    expect(new Set(result.next.ownedUnits).size).toBe(result.next.ownedUnits.length);
    expect(result.next.money).toBe(result.refund);
    expect(result.refund).toBe(result.results.filter((entry) => !entry.isNew).length * 30);
  });
  it('상점 구매는 고정 비용을 차감하고 모집 보장 카운터와 난수를 유지한다', () => {
    const state = { ...initialCollection(), money: 700, pullsSinceNew: 5 };
    const result = buyUnit(state, 'owl');
    if (!result.ok) throw new Error('영입 실패');
    expect(result.next).toMatchObject({ money: 100, rngState: state.rngState, pullsSinceNew: 5 });
    expect(result.next.ownedUnits).toContain('owl');
    expect(state.ownedUnits).not.toContain('owl');
    expect(buyUnit(result.next, 'owl')).toEqual({ ok: false, reason: 'owned' });
  });
  it('미등록·현재 풀에 없는 친구와 부족한 잔액의 구매를 거부한다', () => {
    const state = initialCollection();
    expect(buyUnit(state, 'unknown')).toEqual({ ok: false, reason: 'unknownUnit' });
    expect(buyUnit(state, 'owl', ['squirrel'])).toEqual({ ok: false, reason: 'unknownUnit' });
    expect(buyUnit(state, 'owl')).toEqual({ ok: false, reason: 'noMoney' });
    expect(recruitUnits(state, 1, [])).toEqual({ ok: false, reason: 'unknownUnit' });
  });
  it('저장 실패 때는 구매·머니·보장·난수를 함께 롤백한다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const save = loadSave();
    const before = structuredClone(save);
    expect(commitCollection(save, recruitUnits(save.collection, 1))).toEqual({
      ok: false,
      reason: 'saveFailed',
    });
    expect(save).toEqual(before);
  });
  it('저장 성공 후에만 현재 보유 정보를 바꾼다', () => {
    const storage = { getItem: () => null, setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    const save = loadSave();
    const change = recruitUnits(save.collection, 1);
    expect(commitCollection(save, change).ok).toBe(true);
    expect(storage.setItem).toHaveBeenCalledOnce();
    if (change.ok) expect(save.collection).toEqual(change.next);
  });
});

describe('전투 보상과 보유 캐릭터 배치', () => {
  it.each(Object.values(clears))('$stage는 기본 8종만으로 푸딩 3개를 지킬 수 있다', (scenario) => {
    const filtered = ownedBattleContent(content, scenario.stage, initialCollection().ownedUnits);
    const result = runScenario(filtered, scenario);
    expect(result.state).toMatchObject({ phase: 'won', life: 3, leaked: 0 });
    expect(result.events.filter((event) => event.type === 'commandRejected')).toEqual([]);
    expect(result.state.roster.some((slot) => ['owl', 'wolf'].includes(slot.unitId))).toBe(false);
  });
  it('승리·별·첫 클리어 보너스와 재도전 보상을 구분한다', () => {
    expect(battleMoney('stage-1', true, 120, 3, true)).toBe(720);
    expect(battleMoney('stage-1', true, 120, 3, false)).toBe(320);
    expect(battleMoney('stage-7', true, 498, 3, true)).toBe(2920);
    expect(battleMoney('stage-7', true, 498, 1, false)).toBe(2440);
  });
  it('패배는 실제 처치만 보상하고 상한을 넘지 않는다', () => {
    expect(battleMoney('stage-1', false, 0, 0, true)).toBe(0);
    expect(battleMoney('stage-1', false, 3, 0, false)).toBe(6);
    expect(battleMoney('stage-7', false, 498, 0, false)).toBe(recruitment.defeatMax);
  });
  it('보유 목록만 실제 배치에 허용하고 원본 콘텐츠는 보존한다', () => {
    const filtered = ownedBattleContent(content, 'stage-1', initialCollection().ownedUnits);
    const battle = createBattle(filtered, 'stage-1');
    expect(battle.state.roster).toHaveLength(8);
    expect(battle.checkDeploy('owl', { x: 2, y: 0 }).ok).toBe(false);
    expect(content.stages.get('stage-1')?.roster).toBeUndefined();
    const unlocked = ownedBattleContent(content, 'stage-1', [...initialCollection().ownedUnits, 'owl']);
    expect(createBattle(unlocked, 'stage-1').state.roster.map((slot) => slot.unitId)).toContain('owl');
  });
  it('스테이지의 로스터 제한과 보유 목록의 교집합을 사용한다', () => {
    const stage = content.stages.get('stage-1');
    if (!stage) throw new Error('스테이지 없음');
    const custom = {
      ...content,
      stages: new Map(content.stages).set(stage.id, { ...stage, roster: ['squirrel', 'owl'] }),
    };
    const filtered = ownedBattleContent(custom, stage.id, initialCollection().ownedUnits);
    expect(filtered.stages.get(stage.id)?.roster).toEqual(['squirrel']);
    expect(custom.stages.get(stage.id)?.roster).toEqual(['squirrel', 'owl']);
  });
});
