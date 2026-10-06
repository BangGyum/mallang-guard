import enemies from '../src/data/enemies.json';
import ranges from '../src/data/ranges.json';
import skills from '../src/data/skills.json';
import stage1 from '../src/data/stages/stage-1.json';
import type { ContentDb, RawContent, SpawnGroup, StageDef } from '../src/data/types';
import units from '../src/data/units.json';
import { validateContent } from '../src/data/validate';
import type { Battle } from '../src/sim/battle';
import type { SimEvent } from '../src/sim/types';

export function makeContent(patch?: Partial<RawContent>): ContentDb {
  return validateContent({ units, enemies, skills, ranges, stages: [stage1], ...patch });
}

export function laneStage(map: string[], spawns: SpawnGroup[], opts?: Partial<StageDef>): StageDef {
  function find(marker: string): [number, number] {
    for (const [y, row] of map.entries()) {
      const x = row.indexOf(marker);
      if (x >= 0) return [x, y];
    }
    throw new Error(`테스트 맵에 ${marker}가 없습니다`);
  }
  return {
    id: 'lane',
    name: '테스트 길',
    map,
    startDp: 10,
    life: 3,
    deployLimit: 7,
    routes: { ground: { from: find('S'), to: find('G') } },
    spawns,
    ...opts,
  };
}

export function run(battle: Battle, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let tick = 0; tick < ticks; tick++) events.push(...battle.step());
  return events;
}
