import { assert } from '../core/assert';
import { type Dir, rangeTiles, type Tile } from '../core/grid';
import type { ContentDb } from '../data/types';
import { TICK_RATE } from './constants';
import type { BattleState, DeployCheck, RosterCardView, StageRuntime, UnitEntity } from './types';

export function unitAt(state: Readonly<BattleState>, tile: Tile): UnitEntity | undefined {
  return state.units.find((unit) => unit.tile.x === tile.x && unit.tile.y === tile.y);
}

export function checkDeploy(
  content: ContentDb,
  stage: StageRuntime,
  state: Readonly<BattleState>,
  unitId: string,
  tile: Tile,
): DeployCheck {
  if (state.phase !== 'running') return { ok: false, reason: 'ended' };
  if (state.roster.find((slot) => slot.unitId === unitId)?.state !== 'ready')
    return { ok: false, reason: 'notReady' };
  if (state.units.length >= stage.definition.deployLimit) return { ok: false, reason: 'limit' };
  const def = content.units.get(unitId);
  assert(def, `battle.roster: unknown unit ${unitId}`);
  if (state.dp < def.cost) return { ok: false, reason: 'noDp' };
  if (
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y) ||
    stage.board.kindAt(tile.x, tile.y) !== def.deployOn
  )
    return { ok: false, reason: 'badTile' };
  if (unitAt(state, tile)) return { ok: false, reason: 'occupied' };
  return { ok: true };
}

export function rangeTilesFor(
  content: ContentDb,
  stage: StageRuntime,
  unitId: string,
  tile: Tile,
  dir: Dir,
): Tile[] {
  const def = content.units.get(unitId);
  const range = def && content.ranges.get(def.range);
  assert(range, `battle.units: unknown range for ${unitId}`);
  return rangeTiles(tile, range.tiles, dir, stage.board.width, stage.board.height);
}

export function rosterView(content: ContentDb, state: Readonly<BattleState>): RosterCardView[] {
  return state.roster.map((slot) => {
    const def = content.units.get(slot.unitId);
    assert(def, `battle.roster: unknown unit ${slot.unitId}`);
    return {
      unitId: slot.unitId,
      state: slot.state === 'ready' && state.dp < def.cost ? 'noDp' : slot.state,
      cost: def.cost,
      cooldownSec: slot.cooldownTicks / TICK_RATE,
      uid: slot.uid,
    };
  });
}
