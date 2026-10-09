import type { Dir, Tile } from '../core/grid';
import type { Battle } from '../sim/battle';
import type { RejectReason } from '../sim/types';

export type InputState =
  | { mode: 'idle' }
  | { mode: 'preview'; unitId: string }
  | { mode: 'dragging'; unitId: string; hover: Tile | null }
  | { mode: 'aiming'; unitId: string; tile: Tile; dir: Dir | null }
  | { mode: 'selected'; uid: number };

export function directionFromDrag(dx: number, dy: number): Dir | null {
  if (Math.hypot(dx, dy) < 28) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
}

export function isCardDrag(dx: number, dy: number, panX = false): boolean {
  return Math.hypot(dx, dy) >= 12 && (!panX || Math.abs(dy) >= Math.abs(dx));
}

export function cardDeployReason(battle: Battle, unitId: string): RejectReason | null {
  const card = battle.rosterView().find((entry) => entry.unitId === unitId);
  if (battle.state.phase !== 'running') return 'ended';
  if (!card || card.state === 'cooldown' || card.state === 'deployed') return 'notReady';
  if (battle.state.units.length >= battle.stage.definition.deployLimit) return 'limit';
  return card.state === 'noDp' ? 'noDp' : null;
}
