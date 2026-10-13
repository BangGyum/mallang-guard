import { describe, expect, it } from 'vitest';
import { CRITTER_IDS } from '../src/art/critters';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { parseEffect } from '../src/data/validateEffects';
import { parseUnit } from '../src/data/validateEntities';
import { skillDetailsInfo } from '../src/ui/skillDetails';
import { makeRawContent } from './dataFixtures';

describe('희귀 캐릭터 콘텐츠 계약', () => {
  it.each([
    ['fox', 28, 900, 2.8, 'line5Wide', 'physical'],
    ['redPanda', 30, 560, 2.4, 'front4', 'physical'],
    ['deer', 27, 360, 1.5, 'front4', 'magic'],
  ] as const)('%s의 원안 수치·그림·고지대 배치를 연결한다', (id, cost, atk, interval, range, damageType) => {
    const unit = content.units.get(id);
    expect(unit).toMatchObject({ cost, atk, atkIntervalSec: interval, range, damageType, deployOn: 'high' });
    expect(CRITTER_IDS).toContain(unit?.art);
    expect(unit).not.toHaveProperty('hp');
    expect(content.skills.has(unit?.skill ?? '')).toBe(true);
  });
  it('기존 유닛의 우선순위는 생략하며 잘못된 우선순위를 거부한다', () => {
    const unit = content.units.get('squirrel');
    if (!unit) throw new Error('토리 없음');
    expect(parseUnit(unit, 'unit')).not.toHaveProperty('targetPriority');
    expect(() => parseUnit({ ...unit, targetPriority: 'any' }, 'unit')).toThrow('unit.targetPriority');
  });
  it.each([
    [{ radius: 0, damageMuls: [1] }, 'radius'],
    [{ radius: 1.5, damageMuls: [] }, 'damageMuls'],
    [{ radius: 1.5, damageMuls: [1, 1, 1, 1, 1, 1] }, 'damageMuls'],
    [{ radius: 1.5, damageMuls: [0.5, 0.4] }, 'damageMuls[0]'],
    [{ radius: 1.5, damageMuls: [1, 0.4, 0.8] }, 'damageMuls'],
    [{ radius: 1.5, damageMuls: [1, 0] }, 'damageMuls[1]'],
    [{ radius: 1.5, damageMuls: [1, Number.NaN] }, 'damageMuls[1]'],
  ])('잘못된 연쇄 %j를 거부한다', (effect, field) => {
    expect(() => parseEffect({ type: 'chain', ...effect }, 'chain')).toThrow(`chain.${field}`);
  });
  it('연쇄와 폭발/동시 사격 혼합, 중복 연쇄 설정을 거부한다', () => {
    for (const effect of [
      { type: 'splash', radius: 1 },
      { type: 'multiTarget', count: 3 },
    ] as const) {
      const raw = makeRawContent();
      const skill = raw.skills.find((skill) => skill.id === 'stormChain');
      if (!skill) throw new Error('청뢰 개방 없음');
      skill.effects.push(effect);
      expect(() => validateContent(raw)).toThrow('chain cannot combine');
    }
    const raw = makeRawContent();
    const unit = raw.units.find((unit) => unit.id === 'deer');
    if (!unit?.traits?.[0]) throw new Error('세라 없음');
    unit.traits.push({ ...unit.traits[0] });
    expect(() => validateContent(raw)).toThrow('only one chain');
  });
  it('스킬 상세 수치는 기본 특성과 스킬 효과를 함께 설명한다', () => {
    const info = (id: string) => {
      const unit = content.units.get(id);
      const skill = unit && content.skills.get(unit.skill);
      if (!unit || !skill) throw new Error('스킬 없음');
      return skillDetailsInfo(content, unit, skill);
    };
    expect(info('fox').facts).toContainEqual(['조준', '보스 우선 · 같은 우선순위에서는 골에 가까운 적']);
    expect(info('fox').effects.join(' ')).toContain('220 → 400');
    expect(info('redPanda').facts.flat().join(' ')).toContain('반경 1.2칸');
    expect(info('redPanda').effects.join(' ')).toContain('반경 1.8칸');
    expect(info('deer').facts.flat().join(' ')).toContain('최대 3명');
    expect(info('deer').effects.join(' ')).toContain('100% → 80% → 60% → 40% → 30%');
  });
});
