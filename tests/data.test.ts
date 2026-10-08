import { describe, expect, it } from 'vitest';
import { content, rawContent } from '../src/data';
import type { RawContent } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

describe('content data', () => {
  it('실제 JSON과 원본 순서를 검증하고 21마리의 스폰을 유지한다', () => {
    const db = validateContent(rawContent);
    expect([db.units.size, db.enemies.size, db.skills.size, db.ranges.size, db.stages.size]).toEqual([
      8, 7, 8, 3, 6,
    ]);
    expect(db.unitOrder).toEqual(['squirrel', 'cat', 'bear', 'penguin', 'sheep', 'bunny', 'mole', 'snail']);
    expect(db.stages.get('stage-1')?.spawns.reduce((sum, spawn) => sum + spawn.count, 0)).toBe(21);
    expect([...db.units]).toEqual([...content.units]);
  });
  it('검증 뒤 입력 변경이 콘텐츠 DB를 변경하지 않는다', () => {
    const raw = makeRawContent();
    const db = validateContent(raw);
    const unit = raw.units[0];
    if (!unit) throw new Error('fixture missing');
    unit.atk = 1;
    expect(db.units.get(unit.id)?.atk).toBe(280);
  });
  it('생략 가능한 필드와 count 1의 interval 0을 허용한다', () => {
    const raw = makeRawContent();
    const stage = raw.stages[0];
    if (!stage) throw new Error('fixture missing');
    delete stage.dpPerSec;
    delete stage.routes.ground?.flying;
    stage.roster = ['squirrel'];
    expect(validateContent(raw).stages.get('stage-1')?.dpPerSec).toBeUndefined();
  });
  it.each(['units', 'enemies', 'skills', 'ranges', 'stages'] as const)(
    '%s 중복 id에 경로를 포함한다',
    (kind) => {
      const raw = makeRawContent();
      const entries = raw[kind];
      const duplicate = { ...raw, [kind]: [...entries, entries[0]] };
      expect(() => validateContent(duplicate)).toThrow(`content/${kind}[${entries.length}].id`);
    },
  );
  it.each([
    [
      '없는 스킬',
      'content/units[0].skill',
      (raw: RawContent) => {
        const unit = raw.units[0];
        if (unit) unit.skill = 'missing';
      },
    ],
    [
      '없는 사거리',
      'content/units[0].range',
      (raw: RawContent) => {
        const unit = raw.units[0];
        if (unit) unit.range = 'missing';
      },
    ],
    [
      '지상 배치',
      'content/units[3].deployOn',
      (raw: RawContent) => {
        const unit = raw.units[3];
        if (unit) Object.assign(unit, { deployOn: 'ground' });
      },
    ],
    [
      '유닛 true 피해',
      'content/units[0].damageType',
      (raw: RawContent) => {
        const unit = raw.units[0];
        if (unit) unit.damageType = 'true';
      },
    ],
    [
      '없는 적',
      'content/stages[0].spawns[0].enemy',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.enemy = 'missing';
      },
    ],
    [
      '없는 경로',
      'content/stages[0].spawns[0].route',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.route = 'missing';
      },
    ],
    [
      '상속 프로퍼티 경로',
      'content/stages[0].spawns[0].route',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.route = 'toString';
      },
    ],
    [
      '없는 로스터',
      'content/stages[0].roster[0]',
      (raw: RawContent) => {
        const stage = raw.stages[0];
        if (stage) stage.roster = ['missing'];
      },
    ],
    [
      '행 길이',
      'content/stages[0].map[1]',
      (raw: RawContent) => {
        const stage = raw.stages[0];
        if (stage) stage.map[1] = 'S.G';
      },
    ],
    [
      '지형 문자',
      'content/stages[0].map[0]',
      (raw: RawContent) => {
        const stage = raw.stages[0];
        if (stage) stage.map[0] = '???????????';
      },
    ],
    [
      '비행 적 지상 경로',
      'content/stages[0].spawns[2].route',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[2];
        if (spawn) spawn.route = 'ground';
      },
    ],
    [
      '지상 적 비행 경로',
      'content/stages[0].spawns[0].route',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.route = 'air';
      },
    ],
    [
      '맵 밖 출발',
      'content/stages[0].routes.ground.from',
      (raw: RawContent) => {
        const route = raw.stages[0]?.routes.ground;
        if (route) route.from = [-1, 1];
      },
    ],
    [
      '맵 밖 경유',
      'content/stages[0].routes.ground.via[0]',
      (raw: RawContent) => {
        const route = raw.stages[0]?.routes.ground;
        if (route) route.via = [[11, 0]];
      },
    ],
    [
      '잘못된 출발',
      'content/stages[0].routes.ground.from',
      (raw: RawContent) => {
        const route = raw.stages[0]?.routes.ground;
        if (route) route.from = [1, 1];
      },
    ],
    [
      '잘못된 도착',
      'content/stages[0].routes.ground.to',
      (raw: RawContent) => {
        const route = raw.stages[0]?.routes.ground;
        if (route) route.to = [9, 3];
      },
    ],
    [
      '스폰 수 0',
      'content/stages[0].spawns[0].count',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.count = 0;
      },
    ],
    [
      '스폰 수 소수',
      'content/stages[0].spawns[0].count',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.count = 1.5;
      },
    ],
    [
      '다중 스폰 간격 0',
      'content/stages[0].spawns[0].intervalSec',
      (raw: RawContent) => {
        const spawn = raw.stages[0]?.spawns[0];
        if (spawn) spawn.intervalSec = 0;
      },
    ],
    [
      '최대 SP 초과',
      'content/skills[0].spStart',
      (raw: RawContent) => {
        const skill = raw.skills[0];
        if (skill) skill.spStart = skill.spCost + 1;
      },
    ],
    [
      '허용하지 않는 특성',
      'content/units[0].traits[0].type',
      (raw: RawContent) => {
        const unit = raw.units[0];
        if (unit) unit.traits = [{ type: 'gainDp', value: 1 }];
      },
    ],
  ] as const)('%s를 경로가 있는 오류로 거부한다', (_name, path, patch) => {
    const raw = makeRawContent();
    patch(raw);
    expect(() => validateContent(raw)).toThrow(path);
  });
  it.each(['atkIntervalSec'] as const)('유닛 %s 0을 거부한다', (key) => {
    const raw = makeRawContent();
    const unit = raw.units[0];
    if (unit) unit[key] = 0;
    expect(() => validateContent(raw)).toThrow(`content/units[0].${key}`);
  });
  it.each(['atk', 'cost'] as const)('유닛 %s 음수를 거부한다', (key) => {
    const raw = makeRawContent();
    const unit = raw.units[0];
    if (unit) unit[key] = -1;
    expect(() => validateContent(raw)).toThrow(`content/units[0].${key}`);
  });
  it.each([-1, 101, NaN, Infinity])('마저 %f를 거부한다', (res) => {
    const raw = makeRawContent();
    const enemy = raw.enemies[0];
    if (enemy) enemy.res = res;
    expect(() => validateContent(raw)).toThrow('content/enemies[0].res');
  });
  it.each([
    { raw: null, path: 'content: expected object' },
    { raw: [], path: 'content: expected object' },
    { raw: {}, path: 'content/units: expected array' },
    { raw: { units: null }, path: 'content/units: expected array' },
    { raw: { units: [null] }, path: 'content/units[0]: expected object' },
    { raw: { units: [{ id: 7 }] }, path: 'content/units[0].id: expected nonempty string' },
  ])('원시 입력 오류 $path를 구분한다', ({ raw, path }) => {
    expect(() => validateContent(raw)).toThrow(path);
  });
});
