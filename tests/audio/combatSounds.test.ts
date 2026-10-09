import { describe, expect, it } from 'vitest';
import { unitAttackSound } from '../../src/audio/combatSounds';
import { content } from '../../src/data';

describe('무장에 맞는 발사음', () => {
  it.each([
    ['squirrel', 'shoot'],
    ['cat', 'slash'],
    ['bear', 'hammer'],
    ['penguin', 'sniper'],
    ['sheep', 'magic'],
    ['bunny', 'shoot'],
    ['mole', 'shotgun'],
    ['snail', 'launcher'],
    ['owl', 'energy'],
    ['wolf', 'sniper'],
  ])('%s의 현재 그림과 무기에 맞게 %s를 재생한다', (unitId, sound) => {
    const unit = content.units.get(unitId);
    expect(unit).toBeDefined();
    expect(unitAttackSound(unit?.art ?? '')).toBe(sound);
  });

  it('모든 현재 캐릭터에 전용 공격음을 지정한다', () => {
    expect(content.units.size).toBe(10);
    for (const unit of content.units.values()) expect(unitAttackSound(unit.art)).toBeDefined();
    expect(unitAttackSound('jelly')).toBeUndefined();
  });
});
