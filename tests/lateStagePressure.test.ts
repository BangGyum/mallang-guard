import { describe, expect, it, vi } from 'vitest';
import { content } from '../src/data';
import { Battle } from '../src/sim/battle';
import starts from './fixtures/lateStageStarts.json';
import { runScenario, type Scenario } from './helpers';

const scenarios = import.meta.glob<Scenario>('./scenarios/*.json', { eager: true, import: 'default' });

describe('3~7 정원 중후반 압박', () => {
  it.each(starts)('$id: 첫 구간·맵·경로·초기 예산을 보존한다', (baseline) => {
    const stage = content.stages.get(baseline.id);
    if (!stage) throw new Error('스테이지 없음');
    const waves = Math.max(...baseline.spawns.map((group) => group.wave));
    expect(stage.spawns.filter((group) => group.wave <= waves)).toEqual(baseline.spawns);
    expect(stage.map).toEqual(baseline.map);
    expect(stage.routes).toEqual(baseline.routes);
    expect(stage.startDp).toBe(baseline.startDp);
    expect(stage.life).toBe(3);
    expect(stage.deployLimit).toBe(7);
  });

  it.each(starts)('$id: 적 수와 밀도를 점차 늘리고 보스를 구간당 한 마리로 유지한다', (baseline) => {
    const stage = content.stages.get(baseline.id);
    if (!stage) throw new Error('스테이지 없음');
    const waves = Math.max(...baseline.spawns.map((group) => group.wave));
    const blocks = Array.from({ length: 10 }, (_, index) =>
      stage.spawns.filter((group) => group.wave > index * waves && group.wave <= (index + 1) * waves),
    );
    const totals = blocks.map((block) => block.reduce((sum, group) => sum + group.count, 0));
    expect(Math.max(...stage.spawns.map((group) => group.wave))).toBe(waves * 10);
    expect(totals[9]).toBeGreaterThan(totals[0] ?? 0);
    for (let index = 1; index < totals.length; index++) {
      expect(totals[index]).toBeGreaterThanOrEqual(totals[index - 1] ?? 0);
    }
    for (const block of blocks) {
      expect(block.filter((group) => group.enemy === 'captainJelly').map((group) => group.count)).toEqual([
        1,
      ]);
      if (baseline.id === 'stage-6' || baseline.id === 'stage-7') {
        expect(block.filter((group) => group.enemy === 'kingJelly').map((group) => group.count)).toEqual([1]);
      }
    }
    for (const [index, group] of (blocks[9] ?? []).entries()) {
      const first = baseline.spawns[index];
      if (first && first.count > 1) expect(group.intervalSec).toBeLessThan(first.intervalSec);
    }
  });

  it.each([
    { id: 'stage-3', peak: 12, emptyPercent: 10 },
    { id: 'stage-4', peak: 7, emptyPercent: 8 },
    { id: 'stage-5', peak: 8, emptyPercent: 12 },
    { id: 'stage-6', peak: 8, emptyPercent: 20 },
    { id: 'stage-7', peak: 12, emptyPercent: 10 },
  ])('$id: 실제 스킬 공략으로 무손실 완주하고 길이와 후반 압박을 유지한다', (expected) => {
    const scenario = scenarios[`./scenarios/${expected.id}-clear.json`];
    const baseline = starts.find((stage) => stage.id === expected.id);
    if (!scenario || !baseline) throw new Error('공략 또는 초반 기준 없음');
    const period = baseline.waveRepeat.periodSec;
    const original = Battle.prototype.step;
    let lateTicks = 0;
    let emptyTicks = 0;
    let peak = 0;
    const spy = vi.spyOn(Battle.prototype, 'step').mockImplementation(function (this: Battle) {
      const events = original.call(this);
      if (this.state.tick >= period * 7 * 30) {
        lateTicks++;
        if (this.state.enemies.length === 0) emptyTicks++;
        peak = Math.max(peak, this.state.enemies.length);
      }
      return events;
    });
    try {
      const result = runScenario(content, scenario);
      expect(result.state).toMatchObject({ phase: 'won', life: 3, leaked: 0 });
      expect(result.state.killed).toBe(result.state.totalEnemies);
      expect(result.state.tick / 30).toBeGreaterThanOrEqual(900);
      expect(peak).toBeGreaterThanOrEqual(expected.peak);
      expect((emptyTicks / lateTicks) * 100).toBeLessThan(expected.emptyPercent);
    } finally {
      spy.mockRestore();
    }
  });

  it.each(['stage-3', 'stage-4', 'stage-5'])(
    '%s의 7인 스킬 미사용·초반 이후 중단은 후반에 실패한다',
    (id) => {
      for (const suffix of ['no-skills', 'skills-stop']) {
        const scenario = scenarios[`./scenarios/${id}-${suffix}.json`];
        if (!scenario) throw new Error('대조 공략 없음');
        if (suffix === 'no-skills') expect(scenario.commands.every((c) => c.type === 'deploy')).toBe(true);
        const result = runScenario(content, scenario);
        expect(result.state.phase).toBe('lost');
        expect(result.state.tick / 30).toBeGreaterThan(300);
        expect(result.state.currentWave).toBeGreaterThanOrEqual(20);
      }
    },
  );

  it.each(['stage-6', 'stage-7'])('%s는 초반 이후 스킬을 중단하면 다음 구간을 버티지 못한다', (id) => {
    const scenario = scenarios[`./scenarios/${id}-skills-stop.json`];
    const baseline = starts.find((stage) => stage.id === id);
    if (!scenario || !baseline) throw new Error('대조 공략 없음');
    const result = runScenario(content, scenario);
    expect(result.state.phase).toBe('lost');
    expect(result.state.tick / 30).toBeGreaterThan(baseline.waveRepeat.periodSec);
    expect(result.state.tick / 30).toBeLessThan(baseline.waveRepeat.periodSec * 3);
  });
});
