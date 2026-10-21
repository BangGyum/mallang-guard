export const WEAPON_VFX: Record<
  string,
  {
    art: string;
    size: number;
    arc: number;
    muzzle: number;
    impact?: string;
    power?: number;
    debris?: string;
    skillArt?: string;
    skillImpact?: string;
    skillScale?: number;
  }
> = {
  squirrel: { art: 'bullet', size: 0.28, arc: 0, muzzle: 0.19, skillScale: 1 },
  cat: {
    art: 'slash',
    size: 0.8,
    arc: 0,
    muzzle: 0,
    impact: 'slash',
    debris: 'slash',
    skillArt: 'crescentSlash',
  },
  bear: {
    art: 'shockwave',
    size: 0.9,
    arc: 0,
    muzzle: 0,
    impact: 'impact',
    power: 1.15,
    skillArt: 'hammerWave',
    skillScale: 1.3,
  },
  penguin: {
    art: 'iceRound',
    size: 0.46,
    arc: 0,
    muzzle: 0.26,
    impact: 'frostFlash',
    debris: 'iceRound',
    skillArt: 'iceLance',
    skillScale: 1.35,
  },
  sheep: {
    art: 'arcBolt',
    size: 0.5,
    arc: 0,
    muzzle: 0,
    impact: 'plasmaImpact',
    power: 1,
    debris: 'arcBolt',
    skillArt: 'cometRound',
  },
  bunny: {
    art: 'energyPulse',
    size: 0.3,
    arc: 0,
    muzzle: 0.2,
    impact: 'energyPulse',
    debris: 'signal',
    skillScale: 1,
  },
  mole: { art: 'compactRound', size: 0.26, arc: 0, muzzle: 0.12 },
  snail: { art: 'stickyDrop', size: 0.32, arc: 0.12, muzzle: 0.24, impact: 'goo', debris: 'stickyDrop' },
  owl: {
    art: 'fireball',
    size: 0.78,
    arc: 0.18,
    muzzle: 0.36,
    impact: 'fireBurst',
    power: 1.4,
    debris: 'fireball',
    skillArt: 'infernoRound',
    skillScale: 1.3,
  },
  wolf: { art: 'railRound', size: 1.25, arc: 0, muzzle: 0.28, impact: 'impact', power: 0.8 },
  fox: {
    art: 'mintRailRound',
    size: 0.95,
    arc: 0,
    muzzle: 0.3,
    impact: 'plasmaImpact',
    power: 1.2,
    skillArt: 'chargedRail',
    skillImpact: 'skill-polarAim',
    skillScale: 1.3,
  },
  redPanda: {
    art: 'shellRound',
    size: 0.46,
    arc: 0.85,
    muzzle: 0.3,
    impact: 'shellBurst',
    power: 1.7,
    skillScale: 1.8,
  },
  deer: {
    art: 'flameBolt',
    size: 0.62,
    arc: 0,
    muzzle: 0.3,
    impact: 'flameBloom',
    power: 0.85,
    debris: 'flameBolt',
    skillScale: 1.4,
  },
  snowLeopard: {
    art: 'gravityOrb',
    size: 0.58,
    arc: 0.2,
    muzzle: 0.32,
    impact: 'gravityBurst',
    power: 1.05,
    debris: 'gravityOrb',
    skillArt: 'gravityCore',
    skillScale: 1.25,
  },
};
