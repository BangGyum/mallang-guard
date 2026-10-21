import { assert } from '../src/core/assert';
import type { Dir } from '../src/core/grid';
import type { ContentDb, RawContent, SpawnGroup, StageDef } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import { type Battle, createBattle } from '../src/sim/battle';
import { secToTicks, TICK_RATE } from '../src/sim/constants';
import { hashState } from '../src/sim/hash';
import type { BattleState, SimEvent } from '../src/sim/types';
import { makeRawContent } from './dataFixtures';

export function makeContent(patch: Partial<RawContent> = {}): ContentDb {
  return validateContent({ ...makeRawContent(), ...patch });
}

export function laneStage(map: string[], spawns: SpawnGroup[], options: Partial<StageDef> = {}): StageDef {
  let from: [number, number] | undefined;
  let to: [number, number] | undefined;
  for (const [y, row] of map.entries()) {
    const start = row.indexOf('S');
    const goal = row.indexOf('G');
    if (start >= 0) from = [start, y];
    if (goal >= 0) to = [goal, y];
  }
  assert(from && to, 'laneStage: S and G required');
  return {
    id: 'lane',
    name: '테스트 경로',
    map,
    startDp: 10,
    life: 3,
    deployLimit: 7,
    routes: { ground: { from, to }, air: { from, to, flying: true } },
    spawns,
    ...options,
  };
}

export function run(battle: Battle, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...battle.step());
  return events;
}

export type ScenarioCommand = { atSec: number; unitId: string } & (
  | { type: 'deploy'; tile: readonly [number, number]; dir: Dir }
  | { type: 'retreat' | 'skill' }
);

export interface Scenario {
  stage: string;
  expect: { result: 'won' | 'lost'; minLife?: number };
  commands: readonly ScenarioCommand[];
}

export interface ScenarioOptions {
  maxSec?: number;
  seed?: number;
  commandMode?: 'step' | 'flush';
}

export interface ScenarioResult {
  state: Readonly<BattleState>;
  events: SimEvent[];
  hashes: { tick: number; hash: string }[];
}

export function runScenario(
  content: ContentDb,
  scenario: Scenario,
  options: ScenarioOptions = {},
): ScenarioResult {
  const prefix = `scenario ${scenario.stage}`;
  const stage = content.stages.get(scenario.stage);
  const lastSpawn = Math.max(
    0,
    ...(stage?.spawns.map((group) => group.atSec + (group.count - 1) * group.intervalSec) ?? []),
  );
  const maxSec = options.maxSec ?? lastSpawn + 300;
  assert(Number.isFinite(maxSec) && maxSec > 0, `${prefix}: maxSec must be finite and positive`);
  const schedule = scenario.commands
    .map((command, index) => {
      assert(
        Number.isFinite(command.atSec) && command.atSec >= 0,
        `${prefix}: commands[${index}].atSec must be finite and nonnegative`,
      );
      assert(
        ['deploy', 'retreat', 'skill'].includes(command.type),
        `${prefix}: commands[${index}].type is invalid`,
      );
      return { command, index, tick: secToTicks(command.atSec) };
    })
    .sort((a, b) => a.tick - b.tick || a.index - b.index);
  const battle = createBattle(content, scenario.stage, { seed: options.seed });
  const events: SimEvent[] = [];
  const hashes = [{ tick: 0, hash: hashState(battle.state) }];
  const maxTicks = secToTicks(maxSec);
  let cursor = 0;

  function collect(batch: SimEvent[], tick: number): void {
    const rejected = batch.find((event) => event.type === 'commandRejected');
    assert(!rejected, `${prefix} tick ${tick}: ${rejected?.reason} ${JSON.stringify(rejected?.cmd)}`);
    events.push(...batch);
  }

  while (battle.state.phase === 'running' && battle.state.tick < maxTicks) {
    const tick = battle.state.tick;
    while (schedule[cursor]?.tick === tick) {
      const entry = schedule[cursor];
      assert(entry, `${prefix}: missing scheduled command`);
      const command = entry.command;
      if (command.type === 'deploy') {
        battle.enqueue({
          type: 'deploy',
          unitId: command.unitId,
          tile: { x: command.tile[0], y: command.tile[1] },
          dir: command.dir,
        });
      } else {
        // 같은 틱의 앞선 배치·후퇴를 반영한 뒤 현재 uid를 조회합니다. 시간은 흐르지 않습니다.
        collect(battle.flush(), tick);
        const unit = battle.state.units.find((unit) => unit.unitId === command.unitId);
        assert(unit, `${prefix} tick ${tick}: ${command.type} ${command.unitId}: notDeployed`);
        battle.enqueue({ type: command.type === 'skill' ? 'activateSkill' : 'retreat', uid: unit.uid });
      }
      cursor += 1;
    }
    if (options.commandMode === 'flush') collect(battle.flush(), tick);
    collect(battle.step(), tick);
    if (battle.state.tick % TICK_RATE === 0 || battle.state.phase !== 'running')
      hashes.push({ tick: battle.state.tick, hash: hashState(battle.state) });
  }

  const state = battle.state;
  assert(state.phase !== 'running', `${prefix} tick ${state.tick}: timeout after ${maxSec}s`);
  assert(
    cursor === schedule.length,
    `${prefix} tick ${state.tick}: ${schedule.length - cursor} unrun commands`,
  );
  assert(
    state.phase === scenario.expect.result,
    `${prefix} tick ${state.tick}: expected ${scenario.expect.result}, got ${state.phase}`,
  );
  if (scenario.expect.minLife !== undefined)
    assert(
      state.life >= scenario.expect.minLife,
      `${prefix} tick ${state.tick}: expected life >= ${scenario.expect.minLife}, got ${state.life}`,
    );
  return { state, events, hashes };
}
