import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { stageUnlocked, starCount } from '../src/data/progression';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

describe('별과 스테이지 해금', () => {
  const stages = [...content.stages.values()];
  it('기록이 없을 때 첫 스테이지만 열고 잘못된 인덱스는 거부한다', () => {
    expect(stages.map((_, i) => stageUnlocked(stages, {}, i))).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(stageUnlocked(stages, {}, -1)).toBe(false);
    expect(stageUnlocked(stages, {}, 6)).toBe(false);
  });
  it('별 하나의 클리어도 다음 스테이지를 열고 기존 v1 기록을 재사용한다', () => {
    const records = { 'stage-1': { cleared: true, bestLife: 1 } };
    expect(stageUnlocked(stages, records, 1)).toBe(true);
    expect(stageUnlocked(stages, records, 2)).toBe(false);
    expect(starCount(records['stage-1'])).toBe(1);
  });
  it.each([0, 1, 2, 3])('푸딩 %i개의 클리어를 별로 바꾸며 패배에는 별을 주지 않는다', (bestLife) => {
    expect(starCount({ cleared: true, bestLife })).toBe(bestLife);
    expect(starCount({ cleared: false, bestLife })).toBe(0);
  });
  it('기존에 클리어한 스테이지와 최대 별을 유지한다', () => {
    expect(stageUnlocked(stages, { 'stage-6': { cleared: true, bestLife: 3 } }, 5)).toBe(true);
    expect(starCount({ cleared: true, bestLife: 10 })).toBe(3);
    expect(starCount(undefined)).toBe(0);
  });
});

describe('새 적 데이터 검증', () => {
  it.each(['missing', 'splitJelly', 'crow'])(
    '존재하지 않거나 재분열·다른 비행 종류인 자식 %s를 거부한다',
    (id) => {
      const raw = makeRawContent();
      const parent = raw.enemies.find((enemy) => enemy.id === 'splitJelly');
      if (!parent) throw new Error('fixture');
      parent.split = { enemy: id, count: 2 };
      expect(() => validateContent(raw)).toThrow('split.enemy');
    },
  );
  it.each(['range', 'intervalSec', 'durationSec', 'targets', 'atkIntervalMul'] as const)(
    '잘못된 방해 수치 %s를 거부한다',
    (key) => {
      const raw = makeRawContent();
      const ability = raw.enemies.find((enemy) => enemy.id === 'spitter')?.disrupt;
      if (!ability) throw new Error('fixture');
      ability[key] = 0;
      expect(() => validateContent(raw)).toThrow(`disrupt.${key}`);
    },
  );
});
