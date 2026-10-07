import { describe, expect, it } from 'vitest';
import { recoverDp, ticksPerDp } from '../../src/sim/systems/dp';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('도토리', () => {
  it('30틱마다 1개씩 회복한다', () => {
    const { battle } = makeFixture(laneStage(['S.G', 'HHH'], [{ ...SPAWN, atSec: 500 }]));
    run(battle, 29);
    expect(battle.state).toMatchObject({ dp: 10, dpTicks: 29 });
    battle.step();
    expect(battle.state).toMatchObject({ dp: 11, dpTicks: 0 });
  });
  it('99에서 회복 진행분을 저장하지 않는다', () => {
    const { stage, state } = makeFixture();
    state.dp = 98;
    state.dpTicks = 29;
    recoverDp(stage, state);
    for (let i = 0; i < 50; i++) recoverDp(stage, state);
    expect([state.dp, state.dpTicks]).toEqual([99, 0]);
    state.dp -= 1;
    recoverDp(stage, state);
    expect([state.dp, state.dpTicks]).toEqual([98, 1]);
  });
  it('스테이지 회복 속도를 정수 틱으로 바꾼다', () => {
    const { stage } = makeFixture(laneStage(['S.G', 'HHH'], [], { dpPerSec: 2 }));
    expect(ticksPerDp(stage)).toBe(15);
  });
  it('비용 9인 후퇴는 4개를 환급하며 상한을 넘지 않는다', () => {
    for (const startDp of [10, 99]) {
      const { battle } = makeFixture(laneStage(['S.G', 'HHH'], [{ ...SPAWN, atSec: 500 }], { startDp }));
      battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'left' });
      battle.flush();
      if (startDp === 99) run(battle, 9 * 30);
      battle.enqueue({ type: 'retreat', uid: 1 });
      const events = battle.flush();
      expect(battle.state.dp).toBe(startDp === 10 ? 5 : 99);
      expect(events).toContainEqual({ type: 'unitRetreat', uid: 1, refund: startDp === 10 ? 4 : 0 });
    }
  });
});
