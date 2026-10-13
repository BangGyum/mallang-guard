import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

describe('고정 관통력 데이터', () => {
  it('생략한 관통력을 0으로 정규화하고 원본은 수정하지 않는다', () => {
    const raw = makeRawContent();
    for (const unit of raw.units) delete unit.armorPen;
    const before = structuredClone(raw);
    const parsed = validateContent(raw);
    expect([...parsed.units.values()].every((unit) => unit.armorPen === 0)).toBe(true);
    expect(raw).toEqual(before);
  });
  it.each([0, 1, 100, 1000])('관통력 %s를 허용한다', (armorPen) => {
    const raw = makeRawContent();
    Object.assign(raw.units[0] ?? {}, { armorPen });
    expect(validateContent(raw).units.get('squirrel')?.armorPen).toBe(armorPen);
  });
  it.each([-1, 0.5, Number.NaN, Infinity, '100', null])('잘못된 관통력 %s를 거부한다', (armorPen) => {
    const raw = makeRawContent();
    Object.assign(raw.units[0] ?? {}, { armorPen });
    expect(() => validateContent(raw)).toThrow(/units\[0\]\.armorPen/);
  });
  it.each([-1, 0.5, Number.NaN, Infinity, '40', null])('잘못된 스킬 관통 증가 %s를 거부한다', (value) => {
    const raw = makeRawContent();
    Object.assign(raw.skills[0] ?? {}, { effects: [{ type: 'armorPenAdd', value }] });
    expect(() => validateContent(raw)).toThrow(/skills\[0\]\.effects\[0\]\.value/);
  });
  it('관통 증가는 지속형 스킬에만 허용한다', () => {
    const raw = makeRawContent();
    Object.assign(raw.skills[0] ?? {}, { durationSec: 0, effects: [{ type: 'armorPenAdd', value: 40 }] });
    expect(() => validateContent(raw)).toThrow(/incompatible with durationSec/);
  });
  it('현재 무기별 기본값과 랑랑의 스킬 증가를 로드한다', () => {
    expect([...content.units.values()].map((unit) => [unit.id, unit.armorPen])).toEqual([
      ['squirrel', 5],
      ['cat', 10],
      ['bear', 5],
      ['penguin', 15],
      ['sheep', 0],
      ['bunny', 0],
      ['mole', 10],
      ['snail', 0],
      ['owl', 0],
      ['wolf', 120],
      ['fox', 220],
      ['redPanda', 60],
      ['deer', 0],
    ]);
    expect(content.skills.get('tripleAim')?.effects).toContainEqual({ type: 'armorPenAdd', value: 40 });
  });
});
