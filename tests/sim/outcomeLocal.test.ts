import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { laneStage, makeContent, run } from '../helpers';

function laneBattle(count = 1, life = 3, atSec = 0, intervalSec = 1) {
  const stage = laneStage(
    ['S.G'],
    [{ wave: 1, atSec, enemy: 'jelly', count, intervalSec, route: 'ground' }],
    { life },
  );
  return createBattle(makeContent({ stages: [stage] }), stage.id);
}

describe('승패와 누수', () => {
  it('stage-1은 배치하지 않으면 세 번 누수 후 즉시 패배한다', () => {
    const battle = createBattle(content, 'stage-1');
    const events = run(battle, secToTicks(120));
    expect(battle.state.totalEnemies).toBe(210);
    expect(battle.state.phase).toBe('lost');
    expect(battle.state.life).toBe(0);
    expect(battle.state.leaked).toBe(3);
    expect(events.filter((event) => event.type === 'battleEnd')).toEqual([
      { type: 'battleEnd', result: 'lost' },
    ]);
    const ended = hashState(battle.state);
    expect(run(battle, 60)).toEqual([]);
    expect(hashState(battle.state)).toBe(ended);
  });

  it.each([
    { life: 210, result: 'lost', remaining: 0 },
    { life: 220, result: 'won', remaining: 10 },
  ])('목숨 $life이면 예정된 210마리 전체 이동 후 $result로 끝난다', ({ life, result, remaining }) => {
    const stage = content.stages.get('stage-1');
    if (!stage) throw new Error('stage-1 없음');
    const battle = createBattle(makeContent({ stages: [{ ...stage, life }] }), stage.id);
    const events = run(battle, secToTicks(1100));
    expect(events.filter((event) => event.type === 'enemySpawn')).toHaveLength(210);
    expect(events.filter((event) => event.type === 'enemyLeak')).toHaveLength(210);
    expect(battle.state.enemies).toEqual([]);
    expect(battle.state.life).toBe(remaining);
    expect(battle.state.phase).toBe(result);
    expect(battle.state.currentWave).toBe(50);
  });

  it('같은 틱의 후속 적은 목숨이 0이 된 뒤 이동하거나 누수하지 않는다', () => {
    const stage = laneStage(
      ['S.G'],
      Array.from({ length: 3 }, () => ({
        wave: 1,
        atSec: 0,
        enemy: 'jelly',
        count: 1,
        intervalSec: 0,
        route: 'ground',
      })),
      { life: 1 },
    );
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    const events = run(battle, 200);
    expect(battle.state.leaked).toBe(1);
    expect(battle.state.enemies.map((enemy) => enemy.uid)).toEqual([2, 3]);
    expect(events.slice(-2)).toEqual([
      { type: 'enemyLeak', uid: 1, lifeLeft: 0 },
      { type: 'battleEnd', result: 'lost' },
    ]);
  });

  it('마지막 살아 있는 적이 없어지면 승리 이벤트가 한 번만 나온다', () => {
    const battle = laneBattle();
    battle.step();
    const enemy = battle.state.enemies[0];
    if (!enemy) throw new Error('적 없음');
    enemy.hp = 0; // T1.4의 공격 시스템이 적용할 피해를 대입합니다.
    expect(battle.step()).toEqual([
      { type: 'enemyDie', uid: enemy.uid },
      { type: 'battleEnd', result: 'won' },
    ]);
    expect(battle.state.killed).toBe(1);
    const endedTick = battle.state.tick;
    expect(battle.step()).toEqual([]);
    expect(battle.state.tick).toBe(endedTick);
  });

  it('현재 적이 없어도 나중의 스폰이 남으면 승리하지 않는다', () => {
    const battle = laneBattle(1, 3, 2);
    expect(run(battle, 60)).toEqual([]);
    expect(battle.state.phase).toBe('running');
    expect(battle.step()[0]?.type).toBe('enemySpawn');
  });

  it('스폰이 전혀 없는 스테이지도 첫 틱에 한 번만 승리한다', () => {
    const stage = laneStage(['SG'], []);
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    expect(battle.step()).toEqual([{ type: 'battleEnd', result: 'won' }]);
    expect(battle.step()).toEqual([]);
  });
});
