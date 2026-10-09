import { describe, expect, it, vi } from 'vitest';
import { content, rawContent } from '../src/data';
import { validateContent } from '../src/data/validate';
import { Battle } from '../src/sim/battle';
import earlyStageStarts from './fixtures/earlyStageStarts.json';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*.json', { eager: true, import: 'default' });

describe('1·2 정원 중후반 압박', () => {
  it.each(earlyStageStarts)('$id의 첫 5웨이브·맵·경로·초기 예산은 보존한다', (baseline) => {
    const stage = content.stages.get(baseline.id);
    if (!stage) throw new Error('스테이지 없음');
    expect(stage.spawns.filter((group) => group.wave <= 5)).toEqual(baseline.spawns);
    expect(stage.map).toEqual(baseline.map);
    expect(stage.routes).toEqual(baseline.routes);
    expect(stage.startDp).toBe(baseline.startDp);
    expect(stage.life).toBe(3);
    expect(stage.deployLimit).toBe(7);
  });

  it.each(['stage-1', 'stage-2'])('%s는 50웨이브의 적 수를 단계적으로 늘리고 최종 간격을 줄인다', (id) => {
    const stage = content.stages.get(id);
    if (!stage) throw new Error('스테이지 없음');
    const groups = Array.from({ length: 10 }, (_, cycle) =>
      stage.spawns.filter((group) => group.wave > cycle * 5 && group.wave <= (cycle + 1) * 5),
    );
    const totals = groups.map((block) => block.reduce((sum, group) => sum + group.count, 0));
    expect(Math.max(...stage.spawns.map((group) => group.wave))).toBe(50);
    for (let cycle = 1; cycle < totals.length; cycle++) {
      expect(totals[cycle]).toBeGreaterThanOrEqual(totals[cycle - 1] ?? 0);
    }
    expect(totals[9]).toBeGreaterThanOrEqual((totals[0] ?? 0) * 2.5);
    for (const [index, group] of (groups[9] ?? []).entries()) {
      const first = groups[0]?.[index];
      if (first && first.count > 1) expect(group.intervalSec).toBeLessThan(first.intervalSec);
    }
  });

  it('2 정원 중반부터 양쪽 지상과 공중 적이 같은 웨이브에서 압박한다', () => {
    const stage = content.stages.get('stage-2');
    if (!stage) throw new Error('스테이지 없음');
    for (let wave = 13; wave <= 48; wave += 5) {
      const groups = stage.spawns.filter((group) => group.wave === wave);
      expect(new Set(groups.map((group) => group.route))).toEqual(new Set(['upper', 'lower', 'air']));
      expect(
        Math.max(...groups.map((group) => group.atSec)) - Math.min(...groups.map((group) => group.atSec)),
      ).toBeLessThanOrEqual(4);
    }
  });

  it.each([
    { id: 'stage-1', period: 91, peak: 8, emptyPercent: 40, kills: 426 },
    { id: 'stage-2', period: 95, peak: 12, emptyPercent: 10, kills: 497 },
  ])('$id는 스킬 공략으로 15분 이상 무손실 완주하며 후반 공백이 줄어든다', (expected) => {
    const scenario = scenarios[`./scenarios/${expected.id}-clear.json`];
    if (!scenario) throw new Error('공략 없음');
    const original = Battle.prototype.step;
    let lateTicks = 0;
    let emptyTicks = 0;
    let peak = 0;
    const spy = vi.spyOn(Battle.prototype, 'step').mockImplementation(function (this: Battle) {
      const events = original.call(this);
      if (this.state.tick >= expected.period * 7 * 30) {
        lateTicks++;
        if (this.state.enemies.length === 0) emptyTicks++;
        peak = Math.max(peak, this.state.enemies.length);
      }
      return events;
    });
    try {
      const result = runScenario(content, scenario);
      expect(result.state).toMatchObject({ phase: 'won', life: 3, leaked: 0, killed: expected.kills });
      expect(result.state.tick / 30).toBeGreaterThanOrEqual(900);
      expect(peak).toBeGreaterThanOrEqual(expected.peak);
      expect((emptyTicks / lateTicks) * 100).toBeLessThan(expected.emptyPercent);
      expect(
        result.events.some((event) => event.type === 'skillStart' && event.skillId === 'snowballBarrage'),
      ).toBe(true);
      const baseline = earlyStageStarts.find((stage) => stage.id === expected.id);
      if (!baseline) throw new Error('초반 기준 없음');
      const intro = validateContent({ ...rawContent, stages: [baseline] });
      const firstCycle = runScenario(intro, {
        ...scenario,
        commands: scenario.commands.filter((command) => command.atSec < expected.period),
      });
      expect(result.state.tick / firstCycle.state.tick).toBeGreaterThanOrEqual(10);
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
      expect(result.state.tick / 30).toBeGreaterThan(300);
      expect(result.state.currentWave).toBeGreaterThanOrEqual(20);
    }
  });
});
