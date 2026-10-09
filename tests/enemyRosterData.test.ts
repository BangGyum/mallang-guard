import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

describe('15종 적 데이터 계약', () => {
  it('15종을 원본 변경 없이 읽고 모든 신규 적을 실제 스테이지에서 소개한다', () => {
    const raw = makeRawContent();
    const before = structuredClone(raw);
    const content = validateContent(raw);
    expect(content.enemies.size).toBe(15);
    expect(new Set([...content.enemies.values()].map((enemy) => enemy.art)).size).toBe(15);
    const scheduled = new Set(
      [...content.stages.values()].flatMap((stage) => stage.spawns.map((group) => group.enemy)),
    );
    for (const enemy of raw.enemies.slice(7)) expect(scheduled.has(enemy.id)).toBe(true);
    expect(raw).toEqual(before);
  });

  it.each([
    ['shieldHp', 0],
    ['shieldHp', -1],
    ['shieldHp', '500'],
    ['rush', { intervalSec: 1, durationSec: 2, speedMul: 1.8 }],
    ['rush', { intervalSec: 0, durationSec: 1, speedMul: 1.8 }],
    ['rush', { intervalSec: 6, durationSec: 1, speedMul: 0.5 }],
    ['regenerate', { intervalSec: 3, amount: -1 }],
    ['regenerate', { intervalSec: 3, amount: Number.NaN }],
    ['heal', { intervalSec: 5, amount: 100, range: 0 }],
    ['heal', { intervalSec: 0, amount: 100, range: 2 }],
    ['haste', { range: 2, speedMul: Number.POSITIVE_INFINITY }],
    ['haste', { range: -1, speedMul: 1.2 }],
    ['summon', { intervalSec: 8, enemy: 'miniJelly', count: 1.5, maxCasts: 3 }],
    ['summon', { intervalSec: 8, enemy: 'miniJelly', count: 1, maxCasts: 0 }],
    ['summon', { intervalSec: 0, enemy: 'miniJelly', count: 1, maxCasts: 3 }],
  ])('잘못된 %s 능력 설정을 거부한다', (field, value) => {
    const raw = makeRawContent();
    const invalid = {
      ...raw,
      enemies: raw.enemies.map((enemy, i) => (i === 0 ? { ...enemy, [field]: value } : enemy)),
    };
    expect(() => validateContent(invalid)).toThrow(`content/enemies[0].${field}`);
  });

  it.each(['missing', 'nestJelly', 'splitJelly', 'crow'])(
    '소환 대상 %s의 참조·재소환·재분열·비행 불일치를 거부한다',
    (id) => {
      const raw = makeRawContent();
      const nest = raw.enemies.find((enemy) => enemy.id === 'nestJelly');
      if (!nest?.summon) throw new Error('소환자 없음');
      nest.summon.enemy = id;
      expect(() => validateContent(raw)).toThrow('.summon.enemy:');
    },
  );
});
