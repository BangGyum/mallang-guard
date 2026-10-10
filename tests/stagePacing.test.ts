import { describe, expect, it } from 'vitest';
import { content, rawContent } from '../src/data';
import { validateContent } from '../src/data/validate';
import { parseStage } from '../src/data/validateStage';
import { createBattle } from '../src/sim/battle';
import { secToTicks } from '../src/sim/constants';
import earlyStageStarts from './fixtures/earlyStageStarts.json';
import lateStageStarts from './fixtures/lateStageStarts.json';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*-clear.json', { eager: true, import: 'default' });

describe('반복 입력 호환성과 4~7번 장기전', () => {
  it.each(lateStageStarts)('$id: 기존 반복 입력과 장기전의 10배 길이를 보존한다', (raw) => {
    const stage = validateContent({ ...rawContent, stages: [raw] }).stages.get(raw.id);
    if (!stage) throw new Error('스테이지 없음');
    const repeat = raw.waveRepeat;
    if (!repeat) throw new Error('반복 설정 없음');
    expect(repeat.count).toBe(10);
    const waves = Math.max(...raw.spawns.map((group) => group.wave));
    expect(stage.spawns).toHaveLength(raw.spawns.length * 10);
    for (let cycle = 0; cycle < 10; cycle++) {
      expect(stage.spawns.slice(cycle * raw.spawns.length, (cycle + 1) * raw.spawns.length)).toEqual(
        raw.spawns.map((group) => ({
          ...group,
          wave: group.wave + cycle * waves,
          atSec: group.atSec + cycle * repeat.periodSec,
        })),
      );
    }
    // 3번의 실제 전투는 단축되어 earlyStagePressure에서 길이와 완주를 검사합니다.
    if (raw.id === 'stage-3') return;
    const scenario = scenarios[`./scenarios/${stage.id}-clear.json`];
    if (!scenario) throw new Error('클리어 시나리오 없음');
    const once = validateContent({ ...rawContent, stages: [{ ...raw, waveRepeat: undefined }] });
    const original = createBattle(once, raw.id);
    const commands = scenario.commands.filter((command) => command.atSec < repeat.periodSec);
    let cursor = 0;
    // 미래 웨이브를 기다리는 동안의 스킬 명령은 단일 주기가 끝난 뒤에는 실행하지 않는다.
    while (original.state.phase === 'running' && original.state.tick < secToTicks(repeat.periodSec + 300)) {
      while (commands[cursor] && secToTicks(commands[cursor]?.atSec ?? 0) === original.state.tick) {
        const command = commands[cursor++];
        if (!command) throw new Error('명령 없음');
        if (command.type === 'deploy') {
          original.enqueue({
            type: 'deploy',
            unitId: command.unitId,
            tile: { x: command.tile[0], y: command.tile[1] },
            dir: command.dir,
          });
        } else {
          expect(original.flush().filter((event) => event.type === 'commandRejected')).toEqual([]);
          const unit = original.state.units.find((unit) => unit.unitId === command.unitId);
          if (!unit) throw new Error('배치된 유닛 없음');
          original.enqueue({ type: command.type === 'skill' ? 'activateSkill' : 'retreat', uid: unit.uid });
        }
      }
      expect(original.step().filter((event) => event.type === 'commandRejected')).toEqual([]);
    }
    expect(original.state).toMatchObject({ phase: 'won', life: 3, leaked: 0 });
    const extended = runScenario(content, scenario);
    expect(extended.state.life).toBe(3);
    expect(extended.state.leaked).toBe(0);
    expect(extended.state.killed).toBe(extended.state.totalEnemies);
    expect(extended.state.currentWave).toBe(waves * 10);
    expect(extended.state.tick / original.state.tick).toBeGreaterThanOrEqual(10);
    expect(extended.state.tick / original.state.tick).toBeLessThan(11.5);
  });

  it('검증된 스폰을 다시 검증해도 중복 확장하거나 입력을 변경하지 않는다', () => {
    const before = structuredClone(rawContent);
    validateContent(rawContent);
    expect(rawContent).toEqual(before);
    const resolved = { ...rawContent, stages: [...content.stages.values()] };
    expect(validateContent(resolved)).toEqual(content);
  });

  it.each([
    { count: 0, periodSec: 100 },
    { count: 1.5, periodSec: 100 },
    { count: 10, periodSec: 0 },
    { count: 10, periodSec: 84 },
    { count: 10, periodSec: Number.NaN },
    { count: Number.POSITIVE_INFINITY, periodSec: 100 },
  ])('잘못된 반복 값 %j를 경로를 포함해 거부한다', (waveRepeat) => {
    expect(() => parseStage({ ...earlyStageStarts[0], waveRepeat }, 'stage')).toThrow(/stage.waveRepeat/);
  });
});
