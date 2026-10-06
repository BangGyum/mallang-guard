// Mulberry32 (Tommy Ettinger, CC0): https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
export function mulberry32(state: number): { state: number; value: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: nextState, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}
