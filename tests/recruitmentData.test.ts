import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { recruitment, validateRecruitment, validateRecruitmentReferences } from '../src/data/recruitment';
import raw from '../src/data/recruitment.json';

describe('상점·모집 콘텐츠 계약', () => {
  it('가격·풀·기존/기본 지급·보상 참조를 검증하고 원본을 보존한다', () => {
    const before = structuredClone(raw);
    const rules = validateRecruitment(raw);
    expect(rules).toEqual(recruitment);
    expect(() => validateRecruitmentReferences(rules, content)).not.toThrow();
    expect(raw).toEqual(before);
    expect(rules.starterUnits).toHaveLength(8);
    expect(rules.legacyUnits).toHaveLength(10);
  });
  it.each(['pullCost', 'guaranteeAfter', 'unitPrice', 'maxMoney'] as const)(
    '%s의 0·소수·무한값을 거부한다',
    (field) => {
      for (const value of [0, 0.5, Number.POSITIVE_INFINITY])
        expect(() => validateRecruitment({ ...raw, [field]: value })).toThrow(field);
    },
  );
  it('음수 잔액·가격 이상 환급·지갑 상한 초과·풀 중복/빈 값을 거부한다', () => {
    expect(() => validateRecruitment({ ...raw, startMoney: -1 })).toThrow('startMoney');
    expect(() => validateRecruitment({ ...raw, duplicateRefund: raw.pullCost })).toThrow('duplicateRefund');
    expect(() => validateRecruitment({ ...raw, startMoney: raw.maxMoney + 1 })).toThrow('startMoney');
    expect(() => validateRecruitment({ ...raw, unitPrice: raw.maxMoney + 1 })).toThrow('unitPrice');
    expect(() => validateRecruitment({ ...raw, pool: [] })).toThrow('pool');
    expect(() => validateRecruitment({ ...raw, pool: ['squirrel', 'squirrel'] })).toThrow('duplicate unit');
  });
  it('없는 친구와 없는/누락된 스테이지 보상 참조를 거부한다', () => {
    expect(() => validateRecruitmentReferences({ ...recruitment, pool: ['ghost'] }, content)).toThrow(
      'unknown unit',
    );
    expect(() =>
      validateRecruitmentReferences(
        { ...recruitment, clearRewards: { ...recruitment.clearRewards, ghost: 100 } },
        content,
      ),
    ).toThrow('unknown stage');
    expect(() => validateRecruitmentReferences({ ...recruitment, clearRewards: {} }, content)).toThrow(
      'missing stage',
    );
  });
});
