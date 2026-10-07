import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { secToTicks } from './constants';
import type { UnitEntity } from './types';

export function unitStats(content: ContentDb, unit: Readonly<UnitEntity>) {
  const def = content.units.get(unit.unitId);
  assert(def, `battle.units: unknown unit ${unit.unitId}`);
  return {
    atk: def.atk,
    def: def.def,
    res: def.res,
    block: def.block,
    atkIntervalTicks: secToTicks(def.atkIntervalSec),
  };
}
