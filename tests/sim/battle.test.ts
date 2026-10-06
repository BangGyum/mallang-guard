import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { laneStage, makeContent, run } from '../helpers';

describe('Battle 초기화와 시간', () => {
  it('모든 실제 스테이지의 경로를 전투 시작 때 계산한다', () => {
    for (const stage of content.stages.values()) {
      const battle = createBattle(content, stage.id, { seed: 7 });
      expect(battle.stage.routes.size).toBe(Object.keys(stage.routes).length);
      expect(battle.state.roster.map((slot) => slot.unitId)).toEqual(content.unitOrder);
      expect(battle.state).toMatchObject({ tick: 0, nextUid: 1, rngState: 7, wave: 0 });
    }
  });

  it('없는 스테이지와 막힌 경로를 전투 생성 시 거부한다', () => {
    expect(() => createBattle(content, 'missing')).toThrow('missing');
    const stage = laneStage(['S#G'], []);
    expect(() => createBattle(makeContent({ stages: [stage] }), stage.id)).toThrow('경로');
  });

  it.each([
    [0, 0],
    [0.001, 1],
    [0.05, 2],
    [2.5, 75],
  ])('초 %s를 %s 정수 틱으로 변환한다', (sec, ticks) => {
    expect(secToTicks(sec)).toBe(ticks);
  });

  it('flush는 빈 큐에서 시간을 진행하지 않는다', () => {
    const battle = createBattle(content, 'stage-1');
    const initial = hashState(battle.state);
    expect(battle.flush()).toEqual([]);
    expect(hashState(battle.state)).toBe(initial);
  });

  it('T1.4 이전 명령 처리를 조용히 성공시키지 않는다', () => {
    const battle = createBattle(content, 'stage-1');
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 2, y: 1 }, dir: 'left' });
    expect(() => battle.flush()).toThrow('다음 구현 단계');
    expect(() => battle.step()).toThrow('다음 구현 단계');
    expect(battle.state.tick).toBe(0);
  });

  it('종료 후 큐의 명령은 받은 순서대로 ended 거부된다', () => {
    const stage = laneStage(['SG'], []);
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    battle.step();
    battle.enqueue({ type: 'retreat', uid: 1 });
    battle.enqueue({ type: 'activateSkill', uid: 2 });
    expect(battle.flush()).toEqual([
      { type: 'commandRejected', cmd: { type: 'retreat', uid: 1 }, reason: 'ended' },
      { type: 'commandRejected', cmd: { type: 'activateSkill', uid: 2 }, reason: 'ended' },
    ]);
    expect(battle.flush()).toEqual([]);
    expect(battle.state.tick).toBe(1);
  });

  it('같은 시드로 두 번 실행한 상태 해시가 매 30틱마다 일치한다', () => {
    const first = createBattle(content, 'stage-1', { seed: 3 });
    const second = createBattle(content, 'stage-1', { seed: 3 });
    for (let secondIndex = 0; secondIndex < 60; secondIndex++) {
      expect(run(first, 30)).toEqual(run(second, 30));
      expect(hashState(first.state)).toBe(hashState(second.state));
    }
  });
});
