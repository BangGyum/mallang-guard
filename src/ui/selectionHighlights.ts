import type { Battle } from '../sim/battle';
import type { HighlightState } from '../view/highlights';
import type { InputState } from './inputState';

export function selectionHighlights(battle: Battle, state: InputState): HighlightState {
  if (state.mode === 'preview' || state.mode === 'dragging') {
    const available = [];
    for (let y = 0; y < battle.stage.board.height; y++)
      for (let x = 0; x < battle.stage.board.width; x++)
        if (battle.checkDeploy(state.unitId, { x, y }).ok) available.push({ x, y });
    return state.mode === 'preview'
      ? { available }
      : {
          available,
          hover: state.hover,
          ghost: state.hover ? { unitId: state.unitId, tile: state.hover, dir: null } : undefined,
        };
  }
  if (state.mode === 'aiming')
    return {
      range: state.dir ? battle.rangeTilesFor(state.unitId, state.tile, state.dir) : [],
      ghost: state,
      hover: state.tile,
    };
  if (state.mode === 'selected') {
    const unit = battle.state.units.find((unit) => unit.uid === state.uid);
    if (unit) return { range: battle.rangeTilesFor(unit.unitId, unit.tile, unit.dir), hover: unit.tile };
  }
  return {};
}
