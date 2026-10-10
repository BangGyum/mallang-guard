import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { runScenario, type Scenario } from '../helpers';

const scenarios = import.meta.glob<Scenario>('../scenarios/*.json', { eager: true, import: 'default' });
const clear = scenarios['../scenarios/stage-1-clear.json'];
if (!clear) throw new Error('클리어 시나리오 없음');
const cases = Object.entries(scenarios);

describe('시나리오 결정론', () => {
  it.each(cases)('%s는 같은 시드로 반복하면 30틱 간격 해시와 이벤트가 같다', (_file, scenario) => {
    const first = runScenario(content, scenario, { seed: 77 });
    const second = runScenario(content, scenario, { seed: 77 });
    expect(second.hashes).toEqual(first.hashes);
    expect(second.events).toEqual(first.events);
    expect(second.state).toEqual(first.state);
  });

  it.each(cases)('%s는 정지 중 flush와 다음 step 처리 결과가 같다', (_file, scenario) => {
    const stepped = runScenario(content, scenario, { seed: 0 });
    const flushed = runScenario(content, scenario, { seed: 0, commandMode: 'flush' });
    expect(stepped.state.rngState).toBe(0);
    expect(flushed.hashes).toEqual(stepped.hashes);
    expect(flushed.events).toEqual(stepped.events);
    expect(flushed.state).toEqual(stepped.state);
  });

  it('결정론 검증에 처치 보상·냉각탄 포화와 자동 지원 스킬이 실제 포함된다', () => {
    const result = runScenario(content, clear);
    expect(
      result.events.filter((event) => event.type === 'skillStart').map((event) => event.skillId),
    ).toEqual(expect.arrayContaining(['acornPickup', 'snowballBarrage', 'carrotSoup']));
    expect(result.state).toMatchObject({ phase: 'won', life: 3, killed: 119, leaked: 0 });
  });
});
