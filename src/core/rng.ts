// https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
// 상태를 호출자가 보관해 저장한 지점부터 같은 수열을 재생할 수 있게 한다.
export function mulberry32(state: number): { value: number; state: number } {
  const nextState = ((state >>> 0) + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, state: nextState };
}
