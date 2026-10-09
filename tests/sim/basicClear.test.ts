import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { type Battle, createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import type { SimEvent } from '../../src/sim/types';
import type { Scenario } from '../helpers';
import clear from '../scenarios/stage-1-clear.json';

const scenario = clear as Scenario;
const schedule = scenario.commands.map((command) => ({ command, tick: secToTicks(command.atSec) }));

function enqueueAt(battle: Battle, tick: number): void {
  for (const entry of schedule) {
    if (entry.tick !== tick) continue;
    const command = entry.command;
    if (command.type === 'deploy') {
      battle.enqueue({
        type: 'deploy',
        unitId: command.unitId,
        tile: { x: command.tile[0], y: command.tile[1] },
        dir: command.dir,
      });
    } else {
      expect(battle.flush().filter((event) => event.type === 'commandRejected')).toEqual([]);
      const unit = battle.state.units.find((unit) => unit.unitId === command.unitId);
      if (!unit) throw new Error('배치된 유닛 없음');
      battle.enqueue({ type: command.type === 'skill' ? 'activateSkill' : 'retreat', uid: unit.uid });
    }
  }
}

describe('고지대 디펜스 완주', () => {
  it('일곱 유닛 배치와 수동 스킬로 stage-1의 426마리를 처치한다', () => {
    const battle = createBattle(content, 'stage-1');
    const events: SimEvent[] = [];
    for (let tick = 0; tick < 33000 && battle.state.phase === 'running'; tick++) {
      enqueueAt(battle, tick);
      events.push(...battle.step());
    }
    expect(events.filter((event) => event.type === 'commandRejected')).toEqual([]);
    expect(battle.state).toMatchObject({ phase: 'won', killed: 426, leaked: 0, life: 3 });
  });
  it('스킬을 포함한 같은 입력은 매 틱 같은 상태와 이벤트를 만든다', () => {
    const a = createBattle(content, 'stage-1', { seed: 77 });
    const b = createBattle(content, 'stage-1', { seed: 77 });
    let skills = 0;
    for (let tick = 0; tick < 33000 && a.state.phase === 'running'; tick++) {
      for (const battle of [a, b]) enqueueAt(battle, tick);
      const events = a.step();
      skills += events.filter((event) => event.type === 'skillStart').length;
      expect(b.step()).toEqual(events);
      expect(hashState(b.state)).toBe(hashState(a.state));
    }
    expect(skills).toBeGreaterThan(3);
    expect(a.state).toMatchObject({ phase: 'won', killed: 426, life: 3 });
  });
});
