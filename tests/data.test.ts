import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import type { RouteDef } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import { first, fixture, ground } from './dataFixtures';

describe('콘텐츠 검증', () => {
  it('실제 JSON을 검증하고 원래 유닛 순서를 유지한다', () => {
    const raw = fixture();
    expect(validateContent(raw)).toEqual(content);
    expect(content.unitOrder).toEqual([
      'squirrel',
      'cat',
      'bear',
      'penguin',
      'sheep',
      'bunny',
      'mole',
      'snail',
    ]);
    expect([content.units.size, content.enemies.size, content.skills.size, content.ranges.size]).toEqual([
      8, 3, 8, 3,
    ]);
    expect(first(raw.stages).spawns.reduce((total, spawn) => total + spawn.count, 0)).toBe(21);
  });

  it('검증은 입력 데이터를 수정하지 않는다', () => {
    const raw = fixture();
    const before = structuredClone(raw);
    validateContent(raw);
    expect(raw).toEqual(before);
  });

  it.each([null, [], 'content', 1])('객체가 아닌 루트를 거부한다: %s', (value) => {
    expect(() => validateContent(value)).toThrow('content:');
  });

  it.each(['units', 'enemies', 'skills', 'ranges', 'stages'] as const)(
    '%s 배열과 고유 id를 검사한다',
    (kind) => {
      const raw = fixture();
      const items = raw[kind];
      expect(() => validateContent({ ...raw, [kind]: null })).toThrow(`content/${kind}:`);
      expect(() => validateContent({ ...raw, [kind]: [null] })).toThrow(`content/${kind}[0]:`);
      expect(() => validateContent({ ...raw, [kind]: [...items, items[0]] })).toThrow(
        `content/${kind}[${items.length}].id:`,
      );
    },
  );

  it.each([
    ['id', ''],
    ['name', null],
    ['animal', 1],
    ['role', 'wizard'],
    ['art', 'dragon'],
    ['deployOn', 'air'],
    ['damageType', 'true'],
    ['canHitAir', 'false'],
    ['hp', 0],
    ['hp', -1],
    ['atkIntervalSec', 0],
    ['cost', -1],
    ['atk', -1],
    ['def', -1],
    ['block', -1],
    ['redeploySec', -1],
    ['res', -1],
    ['res', 101],
    ['hp', NaN],
    ['atk', Infinity],
    ['cost', '9'],
  ])('유닛의 잘못된 %s=%s를 경로와 함께 거부한다', (field, value) => {
    const raw = fixture();
    const unit = { ...first(raw.units), [String(field)]: value };
    expect(() => validateContent({ ...raw, units: [unit] })).toThrow(`content/units[0].${field}:`);
  });

  it('고지대 저지와 존재하지 않는 스킬·사거리 참조를 거부한다', () => {
    for (const [field, value] of [
      ['skill', 'missing'],
      ['range', 'missing'],
    ] as const) {
      const raw = fixture();
      expect(() => validateContent({ ...raw, units: [{ ...first(raw.units), [field]: value }] })).toThrow(
        `content/units[0].${field}:`,
      );
    }
    const raw = fixture();
    expect(() =>
      validateContent({ ...raw, units: [{ ...first(raw.units), deployOn: 'high', block: 1 }] }),
    ).toThrow('content/units[0].block:');
  });

  it('traits 허용 효과와 효과 필드를 검사한다', () => {
    const raw = fixture();
    const unit = first(raw.units);
    expect(() =>
      validateContent({ ...raw, units: [{ ...unit, traits: [{ type: 'gainDp', value: 1 }] }] }),
    ).toThrow('content/units[0].traits[0].type:');
    expect(() =>
      validateContent({ ...raw, units: [{ ...unit, traits: [{ type: 'onHitSlow', amount: 2, sec: 1 }] }] }),
    ).toThrow('content/units[0].traits[0].amount:');
  });

  it.each([
    ['hp', 0],
    ['atkIntervalSec', 0],
    ['speed', 0],
    ['atk', -1],
    ['def', -1],
    ['res', 101],
    ['flying', 'true'],
    ['damageType', 'heal'],
    ['art', 'dragon'],
  ])('적의 잘못된 %s=%s를 거부한다', (field, value) => {
    const raw = fixture();
    expect(() =>
      validateContent({ ...raw, enemies: [{ ...first(raw.enemies), [String(field)]: value }] }),
    ).toThrow(`content/enemies[0].${field}:`);
  });

  it.each([
    ['spCost', 0],
    ['spStart', -1],
    ['spStart', 21],
    ['durationSec', -1],
    ['charge', 'time'],
    ['trigger', 'click'],
    ['condition', 'nearby'],
  ])('스킬의 잘못된 %s=%s를 거부한다', (field, value) => {
    const raw = fixture();
    expect(() =>
      validateContent({ ...raw, skills: [{ ...first(raw.skills), [String(field)]: value }] }),
    ).toThrow(`content/skills[0].${field}:`);
  });

  it.each([
    [{ type: 'unknown' }, 'type'],
    [{ type: 'statMul', stat: 'hp', value: 1 }, 'stat'],
    [{ type: 'statMul', stat: 'atk', value: 0 }, 'value'],
    [{ type: 'blockAdd', value: -1 }, 'value'],
    [{ type: 'splash', radius: 0 }, 'radius'],
    [{ type: 'onHitSlow', amount: 0.5, sec: 0 }, 'sec'],
    [{ type: 'stunEveryNthHit', n: 1.5, sec: 1 }, 'n'],
    [{ type: 'gainDp', value: -1 }, 'value'],
    [{ type: 'healAllies', ratioOfMaxHp: 2 }, 'ratioOfMaxHp'],
    [{ type: 'pulseDamage', count: 0, intervalSec: 1, atkMul: 1, damageType: 'magic' }, 'count'],
    [{ type: 'pulseDamage', count: 1, intervalSec: 0, atkMul: 1, damageType: 'magic' }, 'intervalSec'],
    [{ type: 'pulseDamage', count: 1, intervalSec: 1, atkMul: 1, damageType: 'heal' }, 'damageType'],
    [{ type: 'slowAura', amount: -0.1 }, 'amount'],
    [{ type: 'pushback', tiles: -1 }, 'tiles'],
  ])('효과의 잘못된 필드를 거부한다: %j', (effect, field) => {
    const raw = fixture();
    expect(() => validateContent({ ...raw, skills: [{ ...first(raw.skills), effects: [effect] }] })).toThrow(
      `content/skills[0].effects[0].${field}:`,
    );
  });

  it('즉시형과 지속형 효과를 구분하고 pulseDamage 지속시간을 확인한다', () => {
    const raw = fixture();
    const skill = first(raw.skills);
    expect(() => validateContent({ ...raw, skills: [{ ...skill, durationSec: 1 }] })).toThrow(
      'content/skills[0].effects[0].type:',
    );
    expect(() =>
      validateContent({
        ...raw,
        skills: [{ ...skill, effects: [{ type: 'statMul', stat: 'atk', value: 2 }] }],
      }),
    ).toThrow('content/skills[0].effects[0].type:');
    const pulse = {
      ...skill,
      durationSec: 0.5,
      effects: [{ type: 'pulseDamage', count: 3, intervalSec: 0.5, atkMul: 1, damageType: 'magic' }],
    };
    expect(() => validateContent({ ...raw, skills: [pulse] })).toThrow('content/skills[0].durationSec:');
    const valid = fixture();
    valid.skills = valid.skills.map((item) =>
      item.id === 'stardustShower' ? { ...item, durationSec: 1 } : item,
    );
    expect(() => validateContent(valid)).not.toThrow();
  });

  it.each([{ tiles: [[1]] }, { tiles: [[1, 0, 0]] }, { tiles: [[0.5, 0]] }, { tiles: [['1', 0]] }])(
    '사거리 오프셋을 검사한다: %j',
    ({ tiles }) => {
      const raw = fixture();
      expect(() => validateContent({ ...raw, ranges: [{ ...first(raw.ranges), tiles }] })).toThrow(
        'content/ranges[0].tiles[0]',
      );
    },
  );

  it.each([
    [['S.G', '##'], 'map[1]'],
    [['S?G'], 'map[0]'],
    [[], 'map'],
  ])('맵을 검사한다: %j', (map, suffix) => {
    const raw = fixture();
    expect(() => validateContent({ ...raw, stages: [{ ...first(raw.stages), map }] })).toThrow(
      `content/stages[0].${suffix}:`,
    );
  });

  it('지상 경로의 시작·종료와 모든 경유점의 맵 경계를 검사한다', () => {
    const cases: [string, (route: RouteDef) => void][] = [
      [
        'from',
        (route) => {
          route.from = [1, 1];
        },
      ],
      [
        'to',
        (route) => {
          route.to = [9, 3];
        },
      ],
      [
        'from',
        (route) => {
          route.from = [-1, 1];
        },
      ],
      [
        'to',
        (route) => {
          route.to = [11, 3];
        },
      ],
      [
        'via[0]',
        (route) => {
          route.via = [[4, 6]];
        },
      ],
    ];
    for (const [suffix, mutate] of cases) {
      const raw = fixture();
      mutate(ground(first(raw.stages)));
      expect(() => validateContent(raw)).toThrow(`content/stages[0].routes.ground.${suffix}:`);
    }
  });

  it('로스터·적·경로의 참조와 양방향 비행 일치를 검사한다', () => {
    const raw = fixture();
    first(raw.stages).roster = ['missing'];
    expect(() => validateContent(raw)).toThrow('content/stages[0].roster[0]:');
    for (const [field, value] of [
      ['enemy', 'missing'],
      ['route', 'missing'],
      ['enemy', 'crow'],
      ['route', 'air'],
      ['route', 'toString'],
    ] as const) {
      const data = fixture();
      const spawn = first(first(data.stages).spawns);
      spawn[field] = value;
      expect(() => validateContent(data)).toThrow(
        `content/stages[0].spawns[0].${field === 'enemy' && value === 'crow' ? 'route' : field}:`,
      );
    }
  });

  it.each([
    ['count', 0],
    ['count', 1.5],
    ['intervalSec', 0],
    ['intervalSec', -1],
    ['atSec', -1],
    ['wave', 0],
  ])('스폰의 잘못된 %s=%s를 거부한다', (field, value) => {
    const raw = fixture();
    const stage = first(raw.stages);
    stage.spawns = [{ ...first(stage.spawns), [String(field)]: value }];
    expect(() => validateContent(raw)).toThrow(`content/stages[0].spawns[0].${field}:`);
  });

  it('선택 필드의 기본 생략과 단일 적 스폰 간격 0을 허용한다', () => {
    const raw = fixture();
    const stage = first(raw.stages);
    delete stage.dpPerSec;
    ground(stage).flying = false;
    first(stage.spawns).count = 1;
    first(stage.spawns).intervalSec = 0;
    stage.roster = ['squirrel'];
    expect(() => validateContent(raw)).not.toThrow();
  });
});
