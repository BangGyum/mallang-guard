import { describe, expect, it } from 'vitest';
import { type Motion, type Pose, samplePose } from '../../src/view/animation';

function sample(patch: Partial<Motion> = {}, reduced = false): Pose {
  const motion: Motion = {
    kind: 'unit',
    age: 1,
    clock: 0,
    phase: 0,
    attack: 0,
    attackKind: 'shot',
    hit: 0,
    active: false,
    stunned: false,
    exit: null,
    exitAge: 0,
    ...patch,
  };
  const pose: Pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, flash: 0, opacity: 1, rotation: 0 };
  samplePose(motion, reduced, pose);
  return pose;
}

describe('캐릭터 애니메이션', () => {
  it('0.25초에 착지하고 0.4초 뒤 기본 숨쉬기로 돌아온다', () => {
    expect(sample({ age: 0 }).y).toBeCloseTo(1.2);
    expect(sample({ age: 0.25 }).y).toBe(0);
    expect(sample({ age: 0.25 }).scaleY).toBeLessThan(sample().scaleY);
    expect(sample({ age: 0.4 })).toEqual(sample({ age: 2 }));
  });
  it('진행 시간이 같으면 같은 자세이고 입력을 변경하지 않는다', () => {
    expect(sample({ clock: 1.5 })).toEqual(sample({ clock: 1.5 }));
    expect(sample({ clock: 1.5 })).not.toEqual(sample({ clock: 1.7 }));
  });
  it('모션 감소는 숨쉬기·배치 낙하·공격 반동을 생략한다', () => {
    expect(sample({ age: 0, clock: 2, attack: 0.1, active: true }, true)).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      flash: 0,
      opacity: 1,
      rotation: 0,
    });
  });
  it('검격은 앞으로 움직이고 사격은 뒤로 반동하며 종료 후 기본 자세로 돌아온다', () => {
    expect(sample({ attackKind: 'slash', attack: 0.18 }).x).toBeGreaterThan(0);
    expect(sample({ attackKind: 'slash', attack: 0.18 }).rotation).not.toBe(0);
    expect(sample({ attackKind: 'shot', attack: 0.1 }).x).toBeLessThan(0);
    expect(sample({ attackKind: 'slash', attack: 0 })).toEqual(sample());
  });
  it.each(['shot', 'slash', 'impact', 'cast'] as const)(
    '모션 감소 시 %s의 회전·반동을 생략한다',
    (attackKind) => {
      const pose = sample({ attackKind, attack: 0.1 }, true);
      expect([pose.x, pose.y, pose.rotation]).toEqual([0, 0, 0]);
    },
  );
  it('이동 점프를 줄이고 기절한 적은 뛰지 않는다', () => {
    const normal = sample({ kind: 'ground', clock: 0.1 });
    expect(sample({ kind: 'ground', clock: 0.1 }, true).y).toBeCloseTo(normal.y / 2);
    expect(sample({ kind: 'ground', clock: 0.1, stunned: true }).y).toBe(0);
  });
  it('피격 플래시는 0.08초 범위에서 감소하며 모션 감소에서도 보인다', () => {
    expect(sample({ hit: 0.08 }).flash).toBe(1);
    expect(sample({ hit: 0.04 }, true).flash).toBe(0.5);
    expect(sample().flash).toBe(0);
  });
  it.each(['death', 'leak'] as const)('%s 연출은 끝에서 완전히 사라진다', (exit) => {
    const pose = sample({ kind: 'ground', exit, exitAge: 1 });
    expect(pose.scaleY).toBe(0);
    expect(pose.opacity).toBe(0);
    if (exit === 'leak') expect(pose.scaleX).toBe(0);
  });
});
