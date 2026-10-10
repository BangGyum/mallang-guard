import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { makeRawContent } from './dataFixtures';
import { laneStage, makeContent, runScenario, type Scenario, type ScenarioCommand } from './helpers';

const raw = makeRawContent();
const stage = laneStage(
  ['S.G', '#H#'],
  [{ wave: 1, atSec: 1, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
  { startDp: 40, life: 1 },
);
const fixture = makeContent({
  stages: [stage],
  enemies: raw.enemies.map((enemy) => ({ ...enemy, speed: 60 })),
  units: raw.units.map((unit) => ({ ...unit, redeploySec: 0.1 })),
  skills: raw.skills.map((skill) => ({ ...skill, spStart: skill.spCost })),
});
const idle: Scenario = { stage: 'stage-1', expect: { result: 'lost' }, commands: [] };
const deploy: ScenarioCommand = { atSec: 0, type: 'deploy', unitId: 'squirrel', tile: [1, 1], dir: 'down' };

describe('시나리오 실행기', () => {
  it('시간순으로 실행하며 같은 틱의 배치·스킬·후퇴와 재배치 uid를 처리한다', () => {
    const scenario: Scenario = {
      stage: 'lane',
      expect: { result: 'lost' },
      commands: [
        { atSec: 0.2, type: 'skill', unitId: 'squirrel' },
        deploy,
        { atSec: 0, type: 'skill', unitId: 'squirrel' },
        { atSec: 0, type: 'retreat', unitId: 'squirrel' },
        { ...deploy, atSec: 0.1 },
        { atSec: 0.2, type: 'retreat', unitId: 'squirrel' },
      ],
    };
    const before = structuredClone(scenario);
    const stepped = runScenario(fixture, scenario);
    const flushed = runScenario(fixture, scenario, { commandMode: 'flush' });
    expect(flushed).toEqual(stepped);
    expect(scenario).toEqual(before);
    expect(stepped.events.filter((event) => event.type === 'unitDeploy').map((event) => event.uid)).toEqual([
      1, 2,
    ]);
    expect(stepped.events.filter((event) => event.type === 'skillStart').map((event) => event.uid)).toEqual([
      1, 2,
    ]);
    expect(stepped.events.filter((event) => event.type === 'unitRetreat').map((event) => event.uid)).toEqual([
      1, 2,
    ]);
    expect(stepped.state).toMatchObject({ tick: 31, phase: 'lost', units: [], dp: 22 });
  });

  it('서로 다른 초가 같은 틱으로 반올림되면 파일 순서를 유지한다', () => {
    const result = runScenario(fixture, {
      stage: 'lane',
      expect: { result: 'lost' },
      commands: [
        { ...deploy, atSec: 0.049 },
        { atSec: 0.04, type: 'skill', unitId: 'squirrel' },
        { atSec: 0.05, type: 'retreat', unitId: 'squirrel' },
      ],
    });
    expect(result.events.slice(0, 4).map((event) => event.type)).toEqual([
      'unitDeploy',
      'skillReady',
      'skillStart',
      'unitRetreat',
    ]);
  });

  it('0.95초 후퇴를 29틱 시작에 적용한 뒤 그 틱부터 재배치 대기를 줄인다', () => {
    const result = runScenario(fixture, {
      stage: 'lane',
      expect: { result: 'lost' },
      commands: [deploy, { atSec: 0.95, type: 'retreat', unitId: 'squirrel' }],
    });
    expect(result.state.tick).toBe(31);
    expect(result.state.roster.find((slot) => slot.unitId === 'squirrel')).toMatchObject({
      state: 'cooldown',
      cooldownTicks: 1,
    });
  });

  it('거부된 명령은 스테이지·틱·명령·사유와 함께 실패한다', () => {
    const scenario: Scenario = {
      ...idle,
      commands: [{ atSec: 0, type: 'deploy', unitId: 'penguin', tile: [5, 2], dir: 'left' }],
    };
    expect(() => runScenario(content, scenario)).toThrow(/scenario stage-1 tick 0: noDp.*penguin/);
  });

  it('충전 전 스킬 명령을 건너뛰지 않는다', () => {
    const scenario: Scenario = {
      ...idle,
      commands: [
        { ...deploy, tile: [2, 0] },
        { atSec: 1, type: 'skill', unitId: 'squirrel' },
      ],
    };
    expect(() => runScenario(content, scenario)).toThrow(/tick 30: skillNotReady/);
  });

  it.each(['skill', 'retreat'] as const)('배치하지 않은 친구의 %s 명령은 실패한다', (type) => {
    const scenario: Scenario = { ...idle, commands: [{ atSec: 0, type, unitId: 'squirrel' }] };
    expect(() => runScenario(content, scenario)).toThrow(`${type} squirrel: notDeployed`);
  });

  it('후퇴 뒤 같은 틱의 스킬은 이전 uid로 실행하지 않는다', () => {
    const scenario: Scenario = {
      stage: 'lane',
      expect: { result: 'lost' },
      commands: [
        deploy,
        { atSec: 0, type: 'retreat', unitId: 'squirrel' },
        { atSec: 0, type: 'skill', unitId: 'squirrel' },
      ],
    };
    expect(() => runScenario(fixture, scenario)).toThrow('tick 0: skill squirrel: notDeployed');
  });

  it('시간 제한 직전에는 실패하고 마지막 허용 틱에 끝나면 성공한다', () => {
    expect(() => runScenario(content, idle, { maxSec: 773 / 30 })).toThrow(/tick 773: timeout/);
    expect(runScenario(content, idle, { maxSec: 774 / 30 }).state.tick).toBe(774);
  });

  it('승패 기대값 불일치를 실패로 처리한다', () => {
    expect(() => runScenario(content, { ...idle, expect: { result: 'won' } })).toThrow(
      'expected won, got lost',
    );
  });

  it('최소 푸딩 기대값 불일치를 실패로 처리한다', () => {
    expect(() => runScenario(content, { ...idle, expect: { result: 'lost', minLife: 1 } })).toThrow(
      'expected life >= 1, got 0',
    );
  });

  it('승패가 맞아도 종료 뒤 실행되지 않은 명령이 남으면 실패한다', () => {
    const scenario: Scenario = { ...idle, commands: [{ ...deploy, atSec: 100, tile: [2, 0] }] };
    expect(() => runScenario(content, scenario)).toThrow('tick 774: 1 unrun commands');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('잘못된 명령 시각 %s를 거부한다', (atSec) => {
    expect(() => runScenario(content, { ...idle, commands: [{ ...deploy, atSec }] })).toThrow(
      'commands[0].atSec must be finite and nonnegative',
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('잘못된 제한 시간 %s를 거부한다', (maxSec) => {
    expect(() => runScenario(content, idle, { maxSec })).toThrow('maxSec must be finite and positive');
  });
});
