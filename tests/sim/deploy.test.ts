import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { applyCommand } from '../../src/sim/systems/commands';
import type { Command, SimEvent } from '../../src/sim/types';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

const DEPLOY: Command & { type: 'deploy' } = {
  type: 'deploy',
  unitId: 'squirrel',
  tile: { x: 1, y: 1 },
  dir: 'left',
};

describe('배치·후퇴·조회', () => {
  it('6가지 거부 사유를 순서대로 검사하고 거부된 상태는 유지한다', () => {
    const fixture = () => makeFixture(laneStage(['S..G', 'HH##'], [SPAWN], { startDp: 99 }));
    const cases = [
      {
        reason: 'ended',
        setup: (f: ReturnType<typeof fixture>) => {
          f.state.phase = 'lost';
          f.state.dp = 0;
        },
      },
      {
        reason: 'notReady',
        setup: (f: ReturnType<typeof fixture>) => {
          const slot = f.state.roster[0];
          if (slot) slot.state = 'cooldown';
          f.state.dp = 0;
        },
      },
      {
        reason: 'limit',
        setup: (f: ReturnType<typeof fixture>) => {
          f.stage.definition.deployLimit = 1;
          applyCommand(f.content, f.stage, f.state, { ...DEPLOY, unitId: 'mole' }, []);
          f.state.dp = 0;
        },
      },
      {
        reason: 'noDp',
        setup: (f: ReturnType<typeof fixture>) => {
          f.state.dp = 0;
        },
      },
      { reason: 'badTile', setup: (_f: ReturnType<typeof fixture>) => {} },
      {
        reason: 'occupied',
        setup: (f: ReturnType<typeof fixture>) => {
          applyCommand(f.content, f.stage, f.state, { ...DEPLOY, unitId: 'mole' }, []);
        },
      },
    ];
    for (const item of cases) {
      const f = fixture();
      item.setup(f);
      const events: SimEvent[] = [];
      const before = structuredClone(f.state);
      const cmd = ['noDp', 'badTile'].includes(item.reason) ? { ...DEPLOY, tile: { x: 0, y: 0 } } : DEPLOY;
      applyCommand(f.content, f.stage, f.state, cmd, events);
      expect(events).toEqual([{ type: 'commandRejected', cmd, reason: item.reason }]);
      expect(f.state).toEqual(before);
    }
  });
  it('배치 비용·초기 SP·공유 uid와 조회 상태를 반환한다', () => {
    const { battle } = makeFixture();
    expect(battle.checkDeploy('squirrel', DEPLOY.tile)).toEqual({ ok: true });
    expect(battle.rosterView().find((card) => card.unitId === 'bear')?.state).toBe('noDp');
    battle.enqueue(DEPLOY);
    expect(battle.flush()).toEqual([
      { type: 'unitDeploy', uid: 1, unitId: 'squirrel', tile: DEPLOY.tile, dir: 'left' },
    ]);
    expect(battle.state.dp).toBe(1);
    expect(battle.unitAt(DEPLOY.tile)).toMatchObject({
      sp: 8,
      atkCooldown: 0,
      dir: 'left',
    });
    expect(battle.rosterView()[0]).toMatchObject({ state: 'deployed', uid: 1, cost: 9 });
    expect(battle.rangeTilesFor('squirrel', DEPLOY.tile, 'left')).toContainEqual({ x: 0, y: 0 });
    battle.step();
    expect(battle.state.enemies[0]?.uid).toBe(2);
  });
  it('후퇴 후 정확히 재배치 시간만큼 기다리면 준비된다', () => {
    const { battle } = makeFixture(laneStage(['S.G', 'HHH'], [{ ...SPAWN, atSec: 500 }]));
    battle.enqueue(DEPLOY);
    battle.flush();
    battle.enqueue({ type: 'retreat', uid: 1 });
    battle.flush();
    expect(battle.rosterView()[0]).toMatchObject({ state: 'cooldown', cooldownSec: 30 });
    run(battle, 899);
    expect(battle.state.roster[0]).toMatchObject({ state: 'cooldown', cooldownTicks: 1, uid: null });
    battle.step();
    expect(battle.state.roster[0]?.state).toBe('ready');
    expect(battle.unitAt(DEPLOY.tile)).toBeUndefined();
  });
  it('고지대·지상·맵 밖·소수 좌표를 판정한다', () => {
    const { battle } = makeFixture(laneStage(['S.G', 'HH#'], [SPAWN], { startDp: 99 }));
    expect(battle.checkDeploy('penguin', { x: 0, y: 1 }).ok).toBe(true);
    for (const tile of [
      { x: -1, y: 0 },
      { x: 1.5, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]) {
      expect(battle.checkDeploy('squirrel', tile)).toEqual({ ok: false, reason: 'badTile' });
    }
  });
  it('flushとstepの同一ティックの命令適用結果が一致する', () => {
    const { content, stage } = makeFixture();
    const a = createBattle(content, stage.definition.id);
    const b = createBattle(content, stage.definition.id);
    a.enqueue(DEPLOY);
    a.flush();
    a.step();
    b.enqueue(DEPLOY);
    b.step();
    expect(a.state).toEqual(b.state);
  });
});
