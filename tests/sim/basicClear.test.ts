import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import type { Command, SimEvent } from '../../src/sim/types';

const BASIC_DEPLOYMENTS: { tick: number; command: Command }[] = [
  { tick: 0, command: { type: 'deploy', unitId: 'squirrel', tile: { x: 2, y: 1 }, dir: 'left' } },
  { tick: 360, command: { type: 'deploy', unitId: 'penguin', tile: { x: 5, y: 2 }, dir: 'left' } },
  { tick: 810, command: { type: 'deploy', unitId: 'bunny', tile: { x: 3, y: 0 }, dir: 'down' } },
  { tick: 1320, command: { type: 'deploy', unitId: 'sheep', tile: { x: 2, y: 2 }, dir: 'up' } },
  { tick: 1740, command: { type: 'deploy', unitId: 'cat', tile: { x: 6, y: 1 }, dir: 'down' } },
];

describe('M1 기본 전투 완주', () => {
  it('기본 수치와 스킬 없이 다섯 유닛 배치로 stage-1의 21마리를 처치한다', () => {
    const battle = createBattle(content, 'stage-1');
    const events: SimEvent[] = [];
    for (let tick = 0; tick < 6000 && battle.state.phase === 'running'; tick++) {
      for (const deployment of BASIC_DEPLOYMENTS)
        if (deployment.tick === tick) battle.enqueue(deployment.command);
      events.push(...battle.step());
    }
    expect(events.filter((event) => event.type === 'commandRejected')).toEqual([]);
    expect(battle.state).toMatchObject({ phase: 'won', killed: 21, leaked: 0, life: 3 });
  });
});
