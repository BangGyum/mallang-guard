import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { secToTicks } from './constants';
import { rangeTilesFor } from './queries';
import { contains } from './targeting';
import type { BattleState, StageRuntime, UnitEntity } from './types';

export function unitStats(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
) {
  const def = content.units.get(unit.unitId);
  assert(def, `battle.units: unknown unit ${unit.unitId}`);
  let atk = def.atk;
  let interval = def.atkIntervalSec;
  for (const effect of [...(def.traits ?? []), ...unit.buffs]) {
    if (effect.type !== 'statMul') continue;
    if (effect.stat === 'atk') atk *= effect.value;
    else interval *= effect.value;
  }
  for (const source of state.units) {
    for (const effect of source.buffs) {
      if (effect.type !== 'hasteAura') continue;
      const tiles = rangeTilesFor(content, stage, source.unitId, source.tile, source.dir);
      if (contains(tiles, unit.tile.x, unit.tile.y)) interval *= effect.value;
    }
  }
  if (unit.disruptedUntilTick > state.tick) interval *= unit.disruptionMul;
  return { atk, atkIntervalTicks: Math.max(1, secToTicks(interval)) };
}
