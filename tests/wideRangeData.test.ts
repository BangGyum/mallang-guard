import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

function fixture() {
  const raw = makeRawContent();
  const index = raw.skills.findIndex((skill) => skill.id === 'wideBarrage');
  const skill = raw.skills[index];
  if (!skill) throw new Error('광범위 스킬 없음');
  return { raw, index, skill };
}

describe('광범위 사거리 효과 데이터 계약', () => {
  it('지속 스킬의 사거리 참조를 검증하고 입력을 수정하지 않는다', () => {
    const { raw } = fixture();
    const before = structuredClone(raw);
    expect(validateContent(raw).skills.get('wideBarrage')?.effects).toContainEqual({
      type: 'rangeOverride',
      range: 'square10',
    });
    expect(raw).toEqual(before);
  });
  it.each(['missing', ''])('없는/비어 있는 사거리 참조를 거부한다: %s', (range) => {
    const { raw, skill, index } = fixture();
    skill.effects[0] = { type: 'rangeOverride', range };
    expect(() => validateContent(raw)).toThrow(`content/skills[${index}].effects[0].range`);
  });
  it('사거리 변경을 즉시 스킬로 지정하면 거부한다', () => {
    const { raw, skill } = fixture();
    skill.durationSec = 0;
    expect(() => validateContent(raw)).toThrow('effect incompatible with durationSec');
  });
  it('한 스킬에 사거리 변경을 중복 지정하면 거부한다', () => {
    const { raw, skill } = fixture();
    skill.effects.push({ type: 'rangeOverride', range: 'square5' });
    expect(() => validateContent(raw)).toThrow('only one range override per skill');
  });
  it('사거리 변경을 상시 특성으로 지정하면 거부한다', () => {
    const { raw } = fixture();
    const unit = raw.units.find((unit) => unit.id === 'owl');
    if (!unit) throw new Error('광범위 유닛 없음');
    unit.traits = [{ type: 'rangeOverride', range: 'square10' }];
    expect(() => validateContent(raw)).toThrow('effect not allowed as trait');
  });
});
