import { describe, expect, it } from 'vitest';
import { content, rawContent } from '../src/data';
import { validateContent } from '../src/data/validate';
import { parseStage } from '../src/data/validateStage';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*-clear.json', { eager: true, import: 'default' });

describe('10배 길이의 스테이지', () => {
  it.each(rawContent.stages)('$id의 웨이브·스폰을 10회 확장하고 기존 전투 주기를 보존한다', (raw) => {
    const stage = content.stages.get(raw.id);
    if (!stage) throw new Error('스테이지 없음');
    const repeat = raw.waveRepeat;
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
    const scenario = scenarios[`./scenarios/${stage.id}-clear.json`];
    if (!scenario) throw new Error('클리어 시나리오 없음');
    const once = validateContent({ ...rawContent, stages: [{ ...raw, waveRepeat: undefined }] });
    const original = runScenario(once, {
      ...scenario,
      commands: scenario.commands.filter((command) => command.atSec < repeat.periodSec),
    });
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
    expect(() => parseStage({ ...rawContent.stages[0], waveRepeat }, 'stage')).toThrow(/stage.waveRepeat/);
  });
});
