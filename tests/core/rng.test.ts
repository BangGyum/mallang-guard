import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng';

// Original C uint32 operations checked independently with bigint arithmetic:
// https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
const SEED_ONE_SEQUENCE = [
  { state: 1831565814, bits: 2693262067 },
  { state: 3663131627, bits: 11749833 },
  { state: 1199730144, bits: 2265367787 },
  { state: 3031295957, bits: 4213581821 },
  { state: 567894474, bits: 4159151403 },
];

describe('mulberry32', () => {
  it('matches the original algorithm sequence for seed 1', () => {
    let state = 1;

    for (const expected of SEED_ONE_SEQUENCE) {
      const result = mulberry32(state);
      expect(result).toEqual({ value: expected.bits / 4294967296, state: expected.state });
      expect(mulberry32(state)).toEqual(result);
      state = result.state;
    }
  });

  it('replays the same continuation from a saved state', () => {
    const checkpoint = mulberry32(mulberry32(1).state).state;
    let originalState = checkpoint;
    let restoredState = checkpoint;

    for (const expected of SEED_ONE_SEQUENCE.slice(2)) {
      const original = mulberry32(originalState);
      const restored = mulberry32(restoredState);
      expect(restored).toEqual(original);
      expect(restored).toEqual({ value: expected.bits / 4294967296, state: expected.state });
      originalState = original.state;
      restoredState = restored.state;
    }
  });

  it.each([0, 1, 0xffffffff])('keeps outputs in [0, 1) and states unsigned for seed %i', (seed) => {
    let state = seed;

    for (let index = 0; index < 64; index += 1) {
      const result = mulberry32(state);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      expect(Number.isInteger(result.state)).toBe(true);
      expect(result.state).toBeGreaterThanOrEqual(0);
      expect(result.state).toBeLessThanOrEqual(0xffffffff);
      state = result.state;
    }
  });

  it('normalizes equivalent 32-bit input states', () => {
    expect(mulberry32(-1)).toEqual(mulberry32(0xffffffff));
    expect(mulberry32(0x100000000)).toEqual(mulberry32(0));
  });
});
