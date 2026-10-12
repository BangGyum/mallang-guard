import { describe, expect, it } from 'vitest';
import { type Motion, type Pose, samplePose } from '../../src/view/animation';

function pose(motion: Motion, reduced = false): Pose {
  const result: Pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, flash: 0, opacity: 1, rotation: 0 };
  samplePose(motion, reduced, result);
  return result;
}
describe('보스의 준비 동작', () => {
  it.each(['ground', 'air'] as const)('%s 보스는 준비 중 걷거나 날갯짓하지 않는다', (kind) => {
    const motion: Motion = {
      kind,
      age: 1,
      clock: 0,
      phase: 0,
      attack: 0,
      attackKind: 'cast',
      hit: 0,
      active: true,
      stunned: false,
      exit: null,
      exitAge: 0,
    };
    expect(pose({ ...motion, clock: 0.13 })).toEqual(pose(motion));
    expect(pose({ ...motion, clock: 0.13 }, true)).toEqual(pose(motion, true));
    expect(pose({ ...motion, active: false, clock: 0.13 })).not.toEqual(pose({ ...motion, active: false }));
  });
});
