import { describe, expect, it } from 'vitest';
import { CRITTER_IDS, critterSvg } from '../src/art/critters';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { skillDetailsInfo } from '../src/ui/skillDetails';
import { makeRawContent } from './dataFixtures';

describe('노바 콘텐츠 계약', () => {
  it('그림·고지대·대공·비용과 상세 정보가 실제 데이터와 일치한다', () => {
    const unit = content.units.get('snowLeopard');
    const skill = unit && content.skills.get(unit.skill);
    if (!unit || !skill) throw new Error('노바 누락');
    expect(unit).toMatchObject({ cost: 23, atk: 640, atkIntervalSec: 3, deployOn: 'high', canHitAir: true });
    expect(CRITTER_IDS).toContain(unit.art);
    expect(critterSvg('snowLeopard')).toContain('<svg');
    const info = skillDetailsInfo(content, unit, skill);
    expect(info.effects.join(' ')).toContain('1920');
    expect(info.effects.join(' ')).toContain('보스 25%');
    expect(info.facts.flat().join(' ')).toContain('최초 40초');
  });
  it.each([
    { radius: 0 },
    { radius: Number.POSITIVE_INFINITY },
    { slowAmount: -0.1 },
    { bossSlowAmount: 1.1 },
    { atkMul: 0 },
  ])('잘못된 중력장 수치 %j를 거부한다', (patch) => {
    const raw = makeRawContent();
    const skill = raw.skills.find((s) => s.id === 'eventHorizon');
    if (!skill) throw new Error('스킬 없음');
    const invalid = {
      ...raw,
      skills: raw.skills.map((s) => (s === skill ? { ...s, effects: [{ ...s.effects[0], ...patch }] } : s)),
    };
    expect(() => validateContent(invalid)).toThrow('content/skills');
  });
  it.each(['instant', 'noTarget', 'trait', 'duplicate'])('%s로 잘못 연결한 중력장을 거부한다', (mode) => {
    const raw = makeRawContent();
    const skill = raw.skills.find((s) => s.id === 'eventHorizon');
    const unit = raw.units.find((u) => u.id === 'snowLeopard');
    if (!skill || !unit || !skill.effects[0]) throw new Error('노바 없음');
    if (mode === 'instant') skill.durationSec = 0;
    if (mode === 'noTarget') skill.condition = 'always';
    if (mode === 'trait') unit.traits = skill.effects;
    if (mode === 'duplicate') skill.effects.push(skill.effects[0]);
    expect(() => validateContent(raw)).toThrow();
  });
});
