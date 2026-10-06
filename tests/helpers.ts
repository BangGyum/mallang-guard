import { assert } from '../src/core/assert';
import type { ContentDb, RawContent, SpawnGroup, StageDef } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import type { Battle } from '../src/sim/battle';
import type { SimEvent } from '../src/sim/types';
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
