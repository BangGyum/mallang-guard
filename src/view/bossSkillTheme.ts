import type { EnemyDef } from '../data/types';

export function bossSkillTheme(def: EnemyDef) {
  switch (def.bossSkill?.effect.type) {
    case 'rush':
      return { color: def.flying ? '#5494ae' : '#c27a43', effect: 'shockwave' };
    case 'shield':
      return { color: '#639fbc', effect: 'impact' };
    case 'heal':
      return { color: '#58a476', effect: 'signal' };
    case 'disrupt':
      return { color: '#8766ad', effect: 'goo' };
    case 'summon':
      return { color: def.shieldHp ? '#bc9145' : '#b175a9', effect: def.shieldHp ? 'spark' : 'droplet' };
    default:
      return { color: '#b58252', effect: 'ring' };
  }
}
