import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { TICK_RATE } from '../src/sim/constants';
import { hashState } from '../src/sim/hash';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*.json', { eager: true, import: 'default' });

describe('골든 시나리오', () => {
  it('7개 실제 스테이지의 클리어와 무배치 JSON을 모두 검증한다', () => {
    expect(content.stages.size).toBe(7);
    for (const id of content.stages.keys()) {
      const clear = scenarios[`./scenarios/${id}-clear.json`];
      const idle = scenarios[`./scenarios/${id}-idle.json`];
      expect(clear?.expect).toMatchObject({ result: 'won', minLife: 3 });
      expect(idle?.expect.result).toBe('lost');
    }
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

  it('배치와 수동 스킬로 12웨이브의 지상·비행 적 119마리를 처치하고 푸딩 3개를 지킨다', () => {
    const scenario = scenarios['./scenarios/stage-1-clear.json'];
    if (!scenario) throw new Error('클리어 시나리오 없음');
    const result = runScenario(content, scenario);
    expect(result.state).toMatchObject({ phase: 'won', life: 3, killed: 119, leaked: 0, currentWave: 12 });
    expect(result.events.filter((event) => event.type === 'enemyDie')).toHaveLength(119);
    const spawns = result.events.filter((event) => event.type === 'enemySpawn');
    expect(spawns.filter((event) => event.enemyId === 'jelly')).toHaveLength(79);
    expect(spawns.filter((event) => event.enemyId === 'hardJelly')).toHaveLength(17);
    expect(spawns.filter((event) => event.enemyId === 'crow')).toHaveLength(23);
    expect(
      result.events.filter((event) => event.type === 'skillStart').map((event) => event.skillId),
    ).toEqual(expect.arrayContaining(['carrotSoup', 'snowballBarrage', 'stardustShower', 'potLidGuard']));
  });

  it('무배치는 25.8초에 세 번째 누수로 즉시 패배한다', () => {
    const scenario = scenarios['./scenarios/stage-1-idle.json'];
    if (!scenario) throw new Error('무배치 시나리오 없음');
    const result = runScenario(content, scenario);
    expect(result.state).toMatchObject({ phase: 'lost', tick: 774, life: 0, killed: 0, leaked: 3 });
    expect(result.events.filter((event) => event.type === 'enemySpawn')).toHaveLength(7);
    expect(result.events.filter((event) => event.type === 'enemyLeak')).toHaveLength(3);
  });
});
