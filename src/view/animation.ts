import { clamp } from '../core/math';

export type AttackKind = 'shot' | 'slash' | 'impact' | 'cast';
export const ATTACK_DURATION = { shot: 0.14, slash: 0.24, impact: 0.22, cast: 0.18 };
export function attackKindFor(art: string): AttackKind {
  return art === 'cat' ? 'slash' : art === 'bear' ? 'impact' : art === 'sheep' ? 'cast' : 'shot';
}

export interface Motion {
  kind: 'unit' | 'ground' | 'air';
  age: number;
  clock: number;
  phase: number;
  attack: number;
  attackKind: AttackKind;
  hit: number;
  active: boolean;
  stunned: boolean;
  exit: 'death' | 'leak' | null;
  exitAge: number;
}

export interface Pose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  flash: number;
  opacity: number;
  rotation: number;
}

function bounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t - 1.5 / 2.75) ** 2 + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (t - 2.625 / 2.75) ** 2 + 0.984375;
}

export function samplePose(motion: Readonly<Motion>, reduced: boolean, pose: Pose): void {
  pose.x = pose.y = 0;
  pose.rotation = 0;
  pose.scaleX = pose.scaleY = pose.opacity = 1;
  pose.flash = clamp(motion.hit / 0.08, 0, 1);
  if (motion.kind === 'unit') {
    const breath = reduced ? 0 : (1 + Math.sin((motion.clock * Math.PI * 2) / 1.35 + motion.phase)) / 2;
    const amplitude = motion.active ? 1.5 : 1;
    pose.scaleX += breath * 0.018 * amplitude;
    pose.scaleY -= breath * 0.025 * amplitude;
    if (!reduced && motion.age < 0.25) pose.y = 1.2 * (1 - bounce(clamp(motion.age / 0.25, 0, 1)));
    if (!reduced && motion.age >= 0.25 && motion.age < 0.4) {
      const landing = 1 - (motion.age - 0.25) / 0.15;
      pose.scaleX *= 1 + 0.2 * landing;
      pose.scaleY *= 1 - 0.2 * landing;
    }
    if (motion.attack > 0 && !reduced) {
      const recoil = clamp(motion.attack / ATTACK_DURATION[motion.attackKind], 0, 1);
      if (motion.attackKind === 'slash') {
        pose.x += Math.sin((1 - recoil) * Math.PI) * 0.1;
        pose.rotation = Math.sin((1 - recoil) * Math.PI * 2) * 0.3;
      } else if (motion.attackKind === 'impact') {
        pose.y -= Math.sin((1 - recoil) * Math.PI) * 0.06;
        pose.rotation = -0.18 * recoil;
      } else {
        pose.x -= (motion.attackKind === 'cast' ? 0.03 : 0.075) * recoil;
        pose.rotation = 0.06 * recoil;
      }
      pose.scaleX *= 1 - 0.04 * recoil;
      pose.scaleY *= 1 + 0.04 * recoil;
    }
  } else if (!motion.stunned) {
    if (motion.kind === 'air')
      pose.y = Math.sin((motion.clock * Math.PI * 2) / 0.8 + motion.phase) * (reduced ? 0.03 : 0.06);
    else {
      const hop = Math.abs(Math.sin((motion.clock * Math.PI * 2) / 0.5 + motion.phase));
      pose.y = hop * (reduced ? 0.06 : 0.12);
      if (!reduced) {
        pose.scaleX += (1 - hop) * 0.1;
        pose.scaleY -= (1 - hop) * 0.12;
      }
    }
  }
  if (motion.hit > 0 && !reduced) pose.x += 0.04 * pose.flash;
  if (motion.exit) {
    const progress = clamp(motion.exitAge / (motion.exit === 'death' ? 0.25 : 0.2), 0, 1);
    pose.scaleY *= 1 - progress;
    pose.scaleX *= motion.exit === 'death' ? 1 + 0.3 * progress : 1 - progress;
    pose.opacity = 1 - progress;
  }
}
