import { describe, expect, it } from 'vitest';
import { unitAttackSound } from '../../src/audio/combatSounds';
import { weaponImpactSound } from '../../src/audio/impactSounds';
import { content } from '../../src/data';

describe('무장에 맞는 발사음', () => {
  it.each([
    ['squirrel', 'pistol'],
    ['cat', 'slash'],
    ['bear', 'hammer'],
    ['penguin', 'frostShot'],
    ['sheep', 'magic'],
    ['bunny', 'energyShot'],
    ['mole', 'compactPistol'],
    ['snail', 'launcher'],
    ['owl', 'fire'],
    ['wolf', 'sniper'],
    ['fox', 'railgun'],
    ['redPanda', 'mortar'],
    ['deer', 'emberJet'],
    ['snowLeopard', 'gravity'],
  ])('%s의 현재 그림과 무기에 맞게 %s를 재생한다', (unitId, sound) => {
    const unit = content.units.get(unitId);
    expect(unit).toBeDefined();
    expect(unitAttackSound(unit?.art ?? '')).toBe(sound);
  });

  it('모든 현재 캐릭터에 전용 공격음을 지정한다', () => {
    expect(content.units.size).toBe(14);
    for (const unit of content.units.values()) expect(unitAttackSound(unit.art)).toBeDefined();
    expect(new Set([...content.units.values()].map((unit) => unitAttackSound(unit.art))).size).toBe(14);
    expect(unitAttackSound('jelly')).toBeUndefined();
  });
  it('세라의 연쇄 화염은 화염 명중음을 쓰고 밤밤과 발사음을 구분한다', () => {
    expect(weaponImpactSound(unitAttackSound('deer'))).toBe('impact-fire');
    expect(unitAttackSound('deer')).not.toBe(unitAttackSound('owl'));
  });
  it('모든 아군 명중음이 무기 계열로 연결되고 알 수 없는 공격만 공통음으로 대체한다', () => {
    for (const unit of content.units.values())
      expect(weaponImpactSound(unitAttackSound(unit.art))).toMatch(/^impact-/);
    expect(weaponImpactSound('mortar')).toBe('impact-blast');
    expect(weaponImpactSound('fire')).toBe('impact-fire');
    expect(weaponImpactSound('slash')).toBe('impact-blade');
    expect(weaponImpactSound(undefined)).toBe('hit');
  });
});
