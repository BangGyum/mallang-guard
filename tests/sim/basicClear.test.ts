import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { hashState } from '../../src/sim/hash';
import type { Command, SimEvent } from '../../src/sim/types';

const BASIC_DEPLOYMENTS: { tick: number; command: Command }[] = [
  { tick: 0, command: { type: 'deploy', unitId: 'squirrel', tile: { x: 2, y: 0 }, dir: 'down' } },
  { tick: 360, command: { type: 'deploy', unitId: 'penguin', tile: { x: 5, y: 2 }, dir: 'left' } },
  { tick: 810, command: { type: 'deploy', unitId: 'bunny', tile: { x: 3, y: 0 }, dir: 'down' } },
  { tick: 1320, command: { type: 'deploy', unitId: 'sheep', tile: { x: 2, y: 2 }, dir: 'up' } },
  { tick: 1757, command: { type: 'deploy', unitId: 'cat', tile: { x: 6, y: 4 }, dir: 'up' } },
];

describe('고지대 디펜스 완주', () => {
  it('수동 스킬 없이 다섯 유닛 배치로 stage-1의 210마리를 처치한다', () => {
    const battle = createBattle(content, 'stage-1');
    const events: SimEvent[] = [];
    for (let tick = 0; tick < 33000 && battle.state.phase === 'running'; tick++) {
      for (const deployment of BASIC_DEPLOYMENTS)
        if (deployment.tick === tick) battle.enqueue(deployment.command);
      events.push(...battle.step());
    }
    expect(events.filter((event) => event.type === 'commandRejected')).toEqual([]);
    expect(battle.state).toMatchObject({ phase: 'won', killed: 210, leaked: 0, life: 3 });
  });
  it('스킬을 포함한 같은 입력은 매 틱 같은 상태와 이벤트를 만든다', () => {
    const a = createBattle(content, 'stage-1', { seed: 77 });
    const b = createBattle(content, 'stage-1', { seed: 77 });
    let skills = 0;
    for (let tick = 0; tick < 33000 && a.state.phase === 'running'; tick++) {
      for (const battle of [a, b]) {
        for (const entry of BASIC_DEPLOYMENTS) if (entry.tick === tick) battle.enqueue(entry.command);
        if (tick % 30 === 0) {
          for (const unit of battle.state.units) {
            const def = content.units.get(unit.unitId);
            const skill = def && content.skills.get(def.skill);
            if (unit.skillState === 'ready' && skill?.trigger === 'manual')
              battle.enqueue({ type: 'activateSkill', uid: unit.uid });
          }
        }
      }
      const events = a.step();
      skills += events.filter((event) => event.type === 'skillStart').length;
      expect(b.step()).toEqual(events);
      expect(hashState(b.state)).toBe(hashState(a.state));
    }
    expect(skills).toBeGreaterThan(3);
    expect(a.state).toMatchObject({ phase: 'won', killed: 210, life: 3 });
  });
});
