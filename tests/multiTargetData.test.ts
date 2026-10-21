import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

describe('동시 사격 효과 데이터 계약', () => {
  it('원본을 변경하지 않고 최대 대상 수와 사거리를 읽는다', () => {
    const raw = makeRawContent();
    const before = structuredClone(raw);
    expect(validateContent(raw).skills.get('tripleAim')?.effects).toContainEqual({
      type: 'multiTarget',
      count: 3,
    });
    expect(raw).toEqual(before);
  });
  it.each([0, -1, 1.5, '3', Number.NaN, Number.POSITIVE_INFINITY])(
    '잘못된 대상 수 %s를 거부한다',
    (count) => {
      const raw = makeRawContent();
      const index = raw.skills.findIndex((skill) => skill.id === 'tripleAim');
      const invalid = {
        ...raw,
        skills: raw.skills.map((skill, i) =>
          i === index ? { ...skill, effects: [{ type: 'multiTarget', count }] } : skill,
        ),
      };
      expect(() => validateContent(invalid)).toThrow(`content/skills[${index}].effects[0].count`);
    },
  );
  it.each([0, 2])('즉시 사용·중복 대상 수 설정을 거부한다: %i', (mode) => {
    const raw = makeRawContent();
    const skill = raw.skills.find((skill) => skill.id === 'tripleAim');
    if (!skill) throw new Error('삼중 조준 없음');
    if (mode === 0) skill.durationSec = 0;
    else skill.effects.push({ type: 'multiTarget', count: 2 });
    expect(() => validateContent(raw)).toThrow(
      mode === 0 ? 'effect incompatible with durationSec' : 'only one target count per skill',
    );
  });
  it('동시 사격을 상시 특성으로 지정하면 거부한다', () => {
    const raw = makeRawContent();
    const wolf = raw.units.find((unit) => unit.id === 'wolf');
    if (!wolf) throw new Error('랑랑 없음');
    wolf.traits = [{ type: 'multiTarget', count: 3 }];
    expect(() => validateContent(raw)).toThrow('effect not allowed as trait');
  });
});
