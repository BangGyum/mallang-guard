import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { TICK_RATE } from '../src/sim/constants';
import { hashState } from '../src/sim/hash';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*.json', { eager: true, import: 'default' });

describe('골든 시나리오', () => {
  it('클리어와 무배치 JSON을 모두 검증 대상으로 포함한다', () => {
    expect(Object.keys(scenarios)).toEqual(
      expect.arrayContaining(['./scenarios/stage-1-clear.json', './scenarios/stage-1-idle.json']),
    );
  });

  it.each(Object.entries(scenarios))('%s의 기대 결과를 만족한다', (_file, scenario) => {
    const result = runScenario(content, scenario);
    expect(result.state.phase).toBe(scenario.expect.result);
    expect(result.events.filter((event) => event.type === 'battleEnd')).toEqual([
      { type: 'battleEnd', result: scenario.expect.result },
    ]);
    expect(result.events.filter((event) => event.type === 'unitDeploy')).toHaveLength(
      scenario.commands.filter((command) => command.type === 'deploy').length,
    );
    expect(result.hashes.map((entry) => entry.tick)).toEqual([
      ...Array.from({ length: Math.ceil(result.state.tick / TICK_RATE) }, (_, index) => index * TICK_RATE),
      result.state.tick,
    ]);
    expect(result.hashes.at(-1)?.hash).toBe(hashState(result.state));
  });

  it('기본 배치만으로 지상·비행 적 21마리를 처치하고 푸딩 3개를 지킨다', () => {
    const scenario = scenarios['./scenarios/stage-1-clear.json'];
    if (!scenario) throw new Error('클리어 시나리오 없음');
    const result = runScenario(content, scenario);
    expect(result.state).toMatchObject({ phase: 'won', life: 3, killed: 21, leaked: 0, currentWave: 5 });
    expect(result.events.filter((event) => event.type === 'enemyDie')).toHaveLength(21);
    const spawns = result.events.filter((event) => event.type === 'enemySpawn');
    expect(spawns.filter((event) => event.enemyId === 'jelly')).toHaveLength(15);
    expect(spawns.filter((event) => event.enemyId === 'hardJelly')).toHaveLength(3);
    expect(spawns.filter((event) => event.enemyId === 'crow')).toHaveLength(3);
    expect(
      result.events.filter((event) => event.type === 'skillStart').map((event) => event.skillId),
    ).toEqual(expect.arrayContaining(['carrotSoup']));
    expect(result.events.some((event) => event.type === 'skillStart' && event.skillId !== 'carrotSoup')).toBe(
      false,
    );
  });

  it('무배치는 26.8초에 세 번째 누수로 즉시 패배한다', () => {
    const scenario = scenarios['./scenarios/stage-1-idle.json'];
    if (!scenario) throw new Error('무배치 시나리오 없음');
    const result = runScenario(content, scenario);
    expect(result.state).toMatchObject({ phase: 'lost', tick: 804, life: 0, killed: 0, leaked: 3 });
    expect(result.events.filter((event) => event.type === 'enemySpawn')).toHaveLength(6);
    expect(result.events.filter((event) => event.type === 'enemyLeak')).toHaveLength(3);
  });
});
