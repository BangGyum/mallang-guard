import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { skillDetailsInfo } from '../src/ui/skillDetails';
import { makeRawContent } from './dataFixtures';

function info(id: string) {
  const unit = content.units.get(id);
  if (!unit) throw new Error(`유닛 없음: ${id}`);
  const skill = content.skills.get(unit.skill);
  if (!skill) throw new Error(`스킬 없음: ${id}`);
  const result = skillDetailsInfo(content, unit, skill);
  return { facts: Object.fromEntries(result.facts), effects: result.effects.join('\n') };
}

describe('스킬 상세 정보', () => {
  it.each([...content.units.keys()])('%s의 실제 스킬 수치와 효과를 제공한다', (id) => {
    const result = info(id);
    expect(Object.keys(result.facts)).toEqual(['발동', '지속', '충전', 'SP', '준비', '조건']);
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it('시간 충전의 시작 SP와 종료 후 재충전을 구분한다', () => {
    expect(info('squirrel').facts).toMatchObject({
      발동: '수동 발동',
      지속: '12초',
      충전: '전투 시간 1초마다 SP +1',
      SP: '필요 20 · 배치 시 8',
      준비: '최초 12초 · 재충전 20초',
      조건: 'SP가 준비되면 사용 가능',
    });
    expect(info('squirrel').effects).toContain('사거리 안에서 아군이 처치한 적의 도토리 보상 +2');
  });

  it('공격 충전을 초 단위 대기처럼 표시하지 않는다', () => {
    expect(info('cat').facts).toMatchObject({
      충전: '공격할 때마다 SP +1',
      준비: '최초 12회 공격 · 재충전 12회 공격',
    });
    expect(info('cat').effects).toContain('공격 속도 2배 · 공격 간격 1.2초 → 0.6초');
    expect(info('cat').effects).toContain('3번째 공격마다 명중한 적 0.5초 기절');
  });

  it('즉시 밀치기와 적 필요 조건을 표시한다', () => {
    expect(info('mole').facts).toMatchObject({
      지속: '즉시 처리',
      준비: '최초 5초 · 재충전 10초',
      조건: '사거리 안 공격 가능한 적 필요',
    });
    expect(info('mole').effects).toContain('목표 적 1명을 경로 뒤로 2칸');
  });

  it('광범위 스킬의 범위와 기본 능력치 변화량을 표시한다', () => {
    const effects = info('owl').effects;
    expect(effects).toContain('주변 5×5칸 → 주변 10×10칸');
    expect(effects).toContain('공격력 50% 증가 (320 → 480)');
    expect(effects).toContain('공격 속도 2배');
  });

  it('삼중 조준의 독립 목표·관통 강화·공격력 감소를 표시한다', () => {
    const effects = info('wolf').effects;
    expect(effects).toContain('정면 5×1칸 → 정면 5×3칸');
    expect(effects).toContain('서로 다른 적 최대 3명 동시 사격 · 적 한 명당 한 발');
    expect(effects).toContain('관통력 +40 (120 → 160)');
    expect(effects).toContain('공격력 10% 감소');
  });

  it('자동 지원과 펄스의 횟수·간격을 구분한다', () => {
    expect(info('bunny').facts.발동).toBe('조건 충족 시 자동 발동');
    expect(info('bunny').effects).toContain('자신 포함');
    expect(info('bunny').effects).toContain('공격 간격 30% 감소');
    expect(info('sheep').effects).toContain('공격력 130% 마법 피해 · 3회 · 0.5초 간격');
  });

  it('둔화·범위 공격·매 공격 기절의 적용 조건을 표시한다', () => {
    expect(info('penguin').effects).toContain('명중 지점 반경 1칸');
    expect(info('penguin').effects).toContain('이동 속도 30% 감소 · 1.5초');
    expect(info('snail').effects).toContain('사거리 안 적 이동 속도 60% 감소');
    expect(info('bear').effects).toContain('공격마다 명중한 적 0.6초 기절');
  });

  it('데이터 변경을 반영하며 원본 콘텐츠를 수정하지 않는다', () => {
    const raw = makeRawContent();
    const skill = raw.skills.find((entry) => entry.id === 'wideBarrage');
    const unit = raw.units.find((entry) => entry.id === 'owl');
    if (!skill || !unit) throw new Error('광범위 스킬 없음');
    skill.spCost = 40;
    skill.spStart = 12;
    skill.durationSec = 9;
    skill.effects = [
      { type: 'rangeOverride', range: 'square5' },
      { type: 'statMul', stat: 'atk', value: 1.25 },
    ];
    unit.atk = 400;
    const before = structuredClone(raw);
    const db = validateContent(raw);
    const result = skillDetailsInfo(db, unit, skill);
    expect(Object.fromEntries(result.facts)).toMatchObject({
      지속: '9초',
      SP: '필요 40 · 배치 시 12',
      준비: '최초 28초 · 재충전 40초',
    });
    expect(result.effects).toContain('공격력 25% 증가 (400 → 500)');
    expect(result.effects).toContain('사거리 주변 5×5칸 → 주변 5×5칸');
    expect(raw).toEqual(before);
  });
});
