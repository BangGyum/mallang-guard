import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { DEFAULT_SEED, secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import type { Command } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('battle core', () => {
  it('실제 stage-1의 맵·경로·스폰·로스터를 초기화한다', () => {
    const battle = createBattle(content, 'stage-1');
    expect(battle.content).toBe(content);
    expect([battle.stage.board.width, battle.stage.board.height]).toEqual([11, 6]);
    expect(battle.stage.routes.get('ground')?.length).toBe(16);
    expect(battle.stage.spawns.map((group) => group.atTick)).toEqual(
      [
        3, 14, 26, 30, 40, 44, 54, 58, 74, 82, 94, 98, 118, 122, 140, 146, 161, 165, 184, 188, 209, 212, 217,
      ].map(secToTicks),
    );
    expect(battle.state).toMatchObject({
      tick: 0,
      phase: 'running',
      dp: 10,
      life: 3,
      maxLife: 3,
      units: [],
      enemies: [],
      spawnCursor: Array.from({ length: 23 }, () => 0),
      totalEnemies: 119,
      killed: 0,
      leaked: 0,
      currentWave: 0,
      totalWaves: 12,
      nextUid: 1,
      rngState: DEFAULT_SEED,
    });
    expect(battle.state.roster).toEqual(
      content.unitOrder.map((unitId) => ({ unitId, state: 'ready', cooldownTicks: 0, uid: null })),
    );
  });
  it('명시된 로스터 순서와 빈 로스터를 보존한다', () => {
    for (const roster of [['bear', 'squirrel'], []]) {
      const { battle } = makeFixture(laneStage(['S.G'], [], { roster }));
      expect(battle.state.roster.map((slot) => slot.unitId)).toEqual(roster);
    }
  });
  it('seed 0을 보존하고 seed를 uint32로 정규화한다', () => {
    expect(createBattle(content, 'stage-1', { seed: 0 }).state.rngState).toBe(0);
    expect(createBattle(content, 'stage-1', { seed: 4294967297 }).state.rngState).toBe(1);
  });
  it('없는 스테이지를 경로가 포함된 오류로 거부한다', () => {
    expect(() => createBattle(content, 'missing')).toThrow('content/stages: unknown stage "missing"');
  });
  it('끊긴 경로를 전투 시작 시 경로명과 함께 거부한다', () => {
    const stage = laneStage(['S#G'], [SPAWN]);
    expect(() => createBattle(makeContent({ stages: [stage] }), stage.id)).toThrow(
      'content/stages/lane.routes.ground: path: no ground route',
    );
  });
  it('콘텐츠와 스폰의 초 값을 변경하지 않는다', () => {
    const before = JSON.stringify([...content.stages.values()]);
    createBattle(content, 'stage-1');
    expect(JSON.stringify([...content.stages.values()])).toBe(before);
  });
  it('flush는 시간이 흐르거나 적이 스폰되지 않는다', () => {
    const { battle } = makeFixture();
    const before = hashState(battle.state);
    expect(battle.flush()).toEqual([]);
    expect(hashState(battle.state)).toBe(before);
  });
  it('큐의 명령을 복사하고 순서대로 거부하며 한 번만 소비한다', () => {
    const { battle } = makeFixture();
    const deploy: Command = { type: 'deploy', unitId: 'missing', tile: { x: 1, y: 0 }, dir: 'right' };
    battle.enqueue(deploy);
    deploy.unitId = 'squirrel';
    deploy.tile.x = 5;
    battle.enqueue({ type: 'retreat', uid: 99 });
    battle.enqueue({ type: 'activateSkill', uid: 100 });
    expect(battle.state.tick).toBe(0);
    expect(battle.flush()).toEqual([
      {
        type: 'commandRejected',
        cmd: { type: 'deploy', unitId: 'missing', tile: { x: 1, y: 0 }, dir: 'right' },
        reason: 'notReady',
      },
      { type: 'commandRejected', cmd: { type: 'retreat', uid: 99 }, reason: 'notDeployed' },
      { type: 'commandRejected', cmd: { type: 'activateSkill', uid: 100 }, reason: 'notDeployed' },
    ]);
    expect(battle.flush()).toEqual([]);
    expect(battle.state.tick).toBe(0);
  });
  it('step은 명령 거부를 스폰보다 먼저 처리한다', () => {
    const { battle } = makeFixture();
    battle.enqueue({ type: 'retreat', uid: 99 });
    expect(battle.step().map((event) => event.type)).toEqual(['commandRejected', 'enemySpawn']);
    expect(battle.state.tick).toBe(1);
  });
  it('flush로 유효한 배치를 적용해도 틱·스폰·도토리 회복 시간은 흐르지 않는다', () => {
    const { battle } = makeFixture();
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'right' });
    expect(battle.flush()).toMatchObject([{ type: 'unitDeploy', unitId: 'squirrel' }]);
    expect(battle.state).toMatchObject({ tick: 0, dp: 1, enemies: [], nextUid: 2 });
    expect(battle.unitAt({ x: 1, y: 1 })?.uid).toBe(1);
  });
  it('끝난 전투의 step은 큐와 틱을 진행하지 않고 flush는 ended로 거부한다', () => {
    const { battle } = makeFixture(laneStage(['S.G'], []));
    expect(battle.step()).toEqual([{ type: 'battleEnd', result: 'won' }]);
    const hash = hashState(battle.state);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 0 }, dir: 'right' });
    expect(run(battle, 5)).toEqual([]);
    expect(hashState(battle.state)).toBe(hash);
    expect(battle.flush()).toEqual([
      {
        type: 'commandRejected',
        cmd: { type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 0 }, dir: 'right' },
        reason: 'ended',
      },
    ]);
    expect(hashState(battle.state)).toBe(hash);
  });
});

describe('tick conversion', () => {
  it.each([
    [0, 0],
    [0.001, 1],
    [1 / 30, 1],
    [0.05, 2],
    [1, 30],
    [2.85, 86],
  ])('%f초를 정수 %i틱으로 변환한다', (sec, ticks) => {
    expect(secToTicks(sec)).toBe(ticks);
  });
});
