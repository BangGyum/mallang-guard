import { describe, expect, it } from 'vitest';
import type { BossSkillDef } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

function fixture() {
  const raw = makeRawContent();
  const enemy = raw.enemies.find((entry) => entry.id === 'gateJelly');
  if (!enemy?.bossSkill) throw new Error('방벽 스킬 없음');
  return { raw, enemy, skill: enemy.bossSkill };
}

const invalidEffects: [string, BossSkillDef['effect']][] = [
  ['amount', { type: 'shield', amount: 0 }],
  ['amount', { type: 'heal', amount: 0, range: 2, targets: 3 }],
  ['range', { type: 'heal', amount: 250, range: -1, targets: 3 }],
  ['targets', { type: 'heal', amount: 250, range: 2, targets: 0 }],
  ['durationSec', { type: 'rush', durationSec: Number.NaN, speedMul: 1.8 }],
  ['speedMul', { type: 'rush', durationSec: 1, speedMul: 0.5 }],
  ['count', { type: 'summon', enemy: 'miniJelly', count: 1.5, maxCasts: 2 }],
  ['maxCasts', { type: 'summon', enemy: 'miniJelly', count: 1, maxCasts: 0 }],
  ['range', { type: 'disrupt', range: 0, durationSec: 2, atkIntervalMul: 1.5, targets: 3 }],
  ['durationSec', { type: 'disrupt', range: 3, durationSec: 0, atkIntervalMul: 1.5, targets: 3 }],
  ['atkIntervalMul', { type: 'disrupt', range: 3, durationSec: 2, atkIntervalMul: 0.5, targets: 3 }],
  ['targets', { type: 'disrupt', range: 3, durationSec: 2, atkIntervalMul: 1.5, targets: 1.5 }],
];
describe('보스 스킬 데이터 검증', () => {
  it.each(invalidEffects)('효과의 잘못된 %s 수치를 거부한다', (field, effect) => {
    const { raw, skill } = fixture();
    skill.effect = effect;
    expect(() => validateContent(raw)).toThrow(field);
  });
  it.each(['firstCastSec', 'intervalSec', 'windupSec'] as const)('%s의 0·NaN·무한값을 거부한다', (field) => {
    for (const value of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { raw, skill } = fixture();
      skill[field] = value;
      expect(() => validateContent(raw)).toThrow(field);
    }
  });
  it('보스 표기와 보호막 최대값을 요구한다', () => {
    const { raw, enemy } = fixture();
    enemy.boss = false;
    expect(() => validateContent(raw)).toThrow('requires boss');
    enemy.boss = true;
    delete enemy.shieldHp;
    expect(() => validateContent(raw)).toThrow('requires shieldHp');
  });
  it('예고 시간과 기존 능력의 중복을 거부한다', () => {
    const { raw, enemy, skill } = fixture();
    skill.windupSec = skill.intervalSec;
    expect(() => validateContent(raw)).toThrow('windupSec');
    skill.windupSec = 1;
    skill.effect = { type: 'rush', durationSec: skill.intervalSec + 1, speedMul: 1.8 };
    expect(() => validateContent(raw)).toThrow('exceeds interval');
    skill.effect = { type: 'shield', amount: 300 };
    enemy.summon = { intervalSec: 12, enemy: 'miniJelly', count: 1, maxCasts: 3 };
    expect(() => validateContent(raw)).toThrow('cannot overlap');
  });
  it('소환 대상의 존재·비행 일치·재소환을 검증한다', () => {
    const { raw, skill } = fixture();
    skill.effect = { type: 'summon', enemy: 'missing', count: 1, maxCasts: 2 };
    expect(() => validateContent(raw)).toThrow('unknown enemy');
    skill.effect.enemy = 'crow';
    expect(() => validateContent(raw)).toThrow('flying flag');
    skill.effect.enemy = 'gardenKing';
    expect(() => validateContent(raw)).toThrow('cannot summon');
  });
  it('검증에서 원본을 수정하지 않고 모든 효과를 보존한다', () => {
    const { raw } = fixture();
    const before = structuredClone(raw);
    const db = validateContent(raw);
    expect([...db.enemies.values()].filter((enemy) => enemy.bossSkill)).toHaveLength(7);
    expect(raw).toEqual(before);
  });
});
