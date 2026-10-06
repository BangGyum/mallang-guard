import type { BattleState } from './types';

export function hashState(state: Readonly<BattleState>): string {
  const serialized = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
