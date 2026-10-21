import { clamp } from '../core/math';

export type AttackKind =
  | 'pistol'
  | 'compactPistol'
  | 'frostShot'
  | 'stickyShot'
  | 'fireCast'
  | 'stormCast'
  | 'gravityShot'
  | 'shot'
  | 'heavyShot'
  | 'bracedShot'
  | 'bracedLauncher'
  | 'slash'
  | 'impact'
  | 'cast';
export const ATTACK_DURATION = {
  pistol: 0.1,
  compactPistol: 0.08,
  frostShot: 0.19,
  stickyShot: 0.28,
  fireCast: 0.32,
  stormCast: 0.16,
  gravityShot: 0.38,
  shot: 0.14,
  heavyShot: 0.22,
  bracedShot: 0.14,
  bracedLauncher: 0.22,
  slash: 0.24,
  impact: 0.22,
  cast: 0.18,
};
export function attackKindFor(art: string): AttackKind {
  if (art === 'squirrel') return 'pistol';
  if (art === 'mole') return 'compactPistol';
  if (art === 'penguin') return 'frostShot';
  if (art === 'snail') return 'stickyShot';
  if (art === 'wolf') return 'bracedShot';
  if (art === 'redPanda') return 'bracedLauncher';
  if (art === 'fox') return 'heavyShot';
  if (art === 'snowLeopard') return 'gravityShot';
  if (art === 'owl') return 'fireCast';
  if (art === 'deer') return 'stormCast';
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
    const braced = motion.attackKind === 'bracedShot' || motion.attackKind === 'bracedLauncher';
    const breath =
      reduced || braced ? 0 : (1 + Math.sin((motion.clock * Math.PI * 2) / 1.35 + motion.phase)) / 2;
    const amplitude = motion.active ? 1.5 : 1;
    pose.scaleX += breath * 0.006 * amplitude;
    pose.scaleY -= breath * 0.008 * amplitude;
    if (!reduced && motion.age < 0.25) pose.y = 1.2 * (1 - bounce(clamp(motion.age / 0.25, 0, 1)));
    if (!reduced && motion.age >= 0.25 && motion.age < 0.4) {
      const landing = 1 - (motion.age - 0.25) / 0.15;
      pose.scaleX *= 1 + 0.2 * landing;
      pose.scaleY *= 1 - 0.2 * landing;
    }
    if (braced && motion.attack > 0 && !reduced && motion.age >= 0.4) {
      const progress = 1 - clamp(motion.attack / ATTACK_DURATION[motion.attackKind], 0, 1);
      const kick = progress < 0.15 ? progress / 0.15 : ((1 - progress) / 0.85) ** 2;
      // 발 앵커 중심으로만 살짝 젖혀 몸 전체의 이동·늘어남을 피합니다.
      pose.rotation = kick * (motion.attackKind === 'bracedLauncher' ? 0.055 : 0.035);
    }
    if (motion.attack > 0 && !reduced && !braced) {
      const progress = 1 - clamp(motion.attack / ATTACK_DURATION[motion.attackKind], 0, 1);
      const recoil = progress < 0.15 ? progress / 0.15 : ((1 - progress) / 0.85) ** 2;
      const sweep = Math.sin(progress * Math.PI);
      if (motion.attackKind === 'slash') {
        pose.x += sweep * 0.075;
        pose.rotation = Math.sin(progress * Math.PI * 2) * 0.22;
      } else if (motion.attackKind === 'impact') {
        pose.scaleY *= 1 - sweep * 0.035;
        pose.rotation = -0.13 * sweep;
      } else if (motion.attackKind === 'cast') {
        pose.rotation = -0.045 * sweep;
        pose.y += sweep * 0.018;
      } else if (motion.attackKind === 'fireCast') {
        pose.rotation = -0.075 * sweep;
        pose.x += sweep * 0.025;
      } else if (motion.attackKind === 'stormCast') {
        pose.rotation = -0.055 * recoil;
      } else if (motion.attackKind === 'stickyShot') {
        pose.scaleX *= 1 + 0.025 * sweep;
        pose.scaleY *= 1 - 0.025 * sweep;
        pose.rotation = 0.018 * sweep;
      } else if (motion.attackKind === 'gravityShot') {
        pose.rotation = 0.085 * sweep;
        pose.scaleY *= 1 - 0.015 * sweep;
      } else if (motion.attackKind === 'frostShot') {
        pose.rotation = 0.045 * recoil;
        pose.x -= 0.018 * recoil;
      } else {
        const kick =
          motion.attackKind === 'heavyShot'
            ? 0.045
            : motion.attackKind === 'pistol'
              ? 0.02
              : motion.attackKind === 'compactPistol'
                ? 0.01
                : 0.012;
        pose.x -= kick * recoil;
        pose.rotation =
          (motion.attackKind === 'heavyShot' ? 0.07 : motion.attackKind === 'pistol' ? 0.045 : 0.025) *
          recoil;
      }
    }
  } else if (!motion.stunned) {
    if (motion.active) {
      pose.scaleX = reduced ? 1 : 1.08;
      pose.scaleY = reduced ? 1 : 0.9;
    } else if (motion.kind === 'air')
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
