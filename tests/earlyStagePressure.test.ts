import { describe, expect, it, vi } from 'vitest';
import { content } from '../src/data';
import { Battle } from '../src/sim/battle';
import earlyStageStarts from './fixtures/earlyStageStarts.json';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*.json', { eager: true, import: 'default' });

describe('짧고 점차 강해지는 초반 정원', () => {
  it.each(earlyStageStarts)('$id의 맵·경로·초기 예산과 2번의 첫 공세를 보존한다', (baseline) => {
    const stage = content.stages.get(baseline.id);
    if (!stage) throw new Error('스테이지 없음');
    if (baseline.id === 'stage-2')
      expect(stage.spawns.filter((group) => group.wave <= 5)).toEqual(baseline.spawns);
    expect(stage.map).toEqual(baseline.map);
    expect(stage.routes).toEqual(baseline.routes);
    expect(stage.startDp).toBe(baseline.startDp);
    expect(stage.life).toBe(3);
    expect(stage.deployLimit).toBe(7);
  });

  it.each(['stage-1', 'stage-2'])('%s는 짧은 네 구간에서 적 수를 늘리고 최종 간격을 줄인다', (id) => {
    const stage = content.stages.get(id);
    if (!stage) throw new Error('스테이지 없음');
    const span = id === 'stage-1' ? 3 : 5;
    const groups = Array.from({ length: 4 }, (_, cycle) =>
      stage.spawns.filter((group) => group.wave > cycle * span && group.wave <= (cycle + 1) * span),
    );
    const totals = groups.map((block) => block.reduce((sum, group) => sum + group.count, 0));
    expect(Math.max(...stage.spawns.map((group) => group.wave))).toBe(span * 4);
    for (let cycle = 1; cycle < totals.length; cycle++) {
      expect(totals[cycle]).toBeGreaterThanOrEqual(totals[cycle - 1] ?? 0);
    }
    expect(totals[3]).toBeGreaterThanOrEqual((totals[0] ?? 0) * 2.5);
    for (const [index, group] of (groups[3] ?? []).entries()) {
      const first = groups[0]?.[index];
      if (first && first.count > 1) expect(group.intervalSec).toBeLessThan(first.intervalSec);
    }
  });

  it('2 정원 중반부터 양쪽 지상과 공중 적이 같은 웨이브에서 압박한다', () => {
    const stage = content.stages.get('stage-2');
    if (!stage) throw new Error('스테이지 없음');
    for (let wave = 8; wave <= 18; wave += 5) {
      const groups = stage.spawns.filter((group) => group.wave === wave);
      expect(new Set(groups.map((group) => group.route))).toEqual(new Set(['upper', 'lower', 'air']));
      expect(
        Math.max(...groups.map((group) => group.atSec)) - Math.min(...groups.map((group) => group.atSec)),
      ).toBeLessThanOrEqual(4);
    }
  });

  it.each([
    {
      id: 'stage-1',
      lateSec: 154,
      peak: 8,
      emptyPercent: 40,
      kills: 119,
      minSec: 210,
      maxSec: 270,
      idle: 38,
    },
    {
      id: 'stage-2',
      lateSec: 236,
      peak: 12,
      emptyPercent: 10,
      kills: 192,
      minSec: 330,
      maxSec: 390,
      idle: 8,
    },
    {
      id: 'stage-3',
      lateSec: 309,
      peak: 12,
      emptyPercent: 10,
      kills: 369,
      minSec: 450,
      maxSec: 510,
      idle: 8,
    },
  ])('$id는 제한된 길이·공백 안에서 실제 배치와 스킬로 무손실 완주한다', (expected) => {
    const scenario = scenarios[`./scenarios/${expected.id}-clear.json`];
    if (!scenario) throw new Error('공략 없음');
    const original = Battle.prototype.step;
    let lateTicks = 0;
    let emptyTicks = 0;
    let peak = 0;
    let empty = 0;
    let emptyRun = 0;
    let longestEmpty = 0;
    const spy = vi.spyOn(Battle.prototype, 'step').mockImplementation(function (this: Battle) {
      const events = original.call(this);
      if (this.state.enemies.length === 0) {
        empty++;
        longestEmpty = Math.max(longestEmpty, ++emptyRun);
      } else emptyRun = 0;
      if (this.state.tick >= expected.lateSec * 30) {
        lateTicks++;
        if (this.state.enemies.length === 0) emptyTicks++;
        peak = Math.max(peak, this.state.enemies.length);
      }
      return events;
    });
    try {
      const result = runScenario(content, scenario);
      expect(result.state).toMatchObject({ phase: 'won', life: 3, leaked: 0, killed: expected.kills });
      expect(result.state.tick / 30).toBeGreaterThan(expected.minSec);
      expect(result.state.tick / 30).toBeLessThan(expected.maxSec);
      expect((empty / result.state.tick) * 100).toBeLessThan(expected.idle);
      expect(longestEmpty / 30).toBeLessThan(12);
      expect(peak).toBeGreaterThanOrEqual(expected.peak);
      expect((emptyTicks / lateTicks) * 100).toBeLessThan(expected.emptyPercent);
      expect(
        result.events.some((event) => event.type === 'skillStart' && event.skillId === 'snowballBarrage'),
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it.each(['stage-1', 'stage-2'])('%s의 기존 4인 배치와 스킬 없는 7인 배치는 중후반에 실패한다', (id) => {
    for (const suffix of ['four-idle', 'no-skills']) {
      const scenario = scenarios[`./scenarios/${id}-${suffix}.json`];
      if (!scenario) throw new Error('무조작 공략 없음');
      expect(scenario.commands.every((command) => command.type === 'deploy')).toBe(true);
      const result = runScenario(content, scenario);
      expect(result.state.phase).toBe('lost');
      expect(result.state.tick / 30).toBeGreaterThan(150);
      expect(result.state.currentWave).toBeGreaterThan(result.state.totalWaves / 2);
    }
  });

  it('1번은 30초 안에 비행 적을 소개하고 마지막에 세 종류의 혼성 공세를 보낸다', () => {
    const spawns = content.stages.get('stage-1')?.spawns ?? [];
    expect(spawns.find((group) => group.enemy === 'crow')?.atSec).toBeLessThanOrEqual(30);
    expect(new Set(spawns.filter((group) => group.wave === 12).map((group) => group.enemy))).toEqual(
      new Set(['jelly', 'hardJelly', 'crow']),
    );
  });
});
