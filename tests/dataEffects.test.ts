import { describe, expect, it } from 'vitest';
import type { Effect } from '../src/data/types';
import { validateContent } from '../src/data/validate';
import { makeRawContent } from './dataFixtures';

const effects: Effect[] = [
  { type: 'statMul', stat: 'atk', value: 2 },
  { type: 'blockAdd', value: 1 },
  { type: 'splash', radius: 1 },
  { type: 'onHitSlow', amount: 0.3, sec: 1 },
  { type: 'stunEveryNthHit', n: 3, sec: 0.5 },
  { type: 'gainDp', value: 12 },
  { type: 'healAllies', ratioOfMaxHp: 0.3 },
  { type: 'pulseDamage', count: 3, intervalSec: 0.5, atkMul: 1.3, damageType: 'magic' },
  { type: 'slowAura', amount: 0.6 },
  { type: 'pushback', tiles: 2 },
];

describe('content effects', () => {
  it.each(effects)('$type 효과를 해당 지속 시간으로 검증한다', (effect) => {
    const raw = makeRawContent();
    const skill = raw.skills[0];
    if (!skill) throw new Error('fixture missing');
    skill.effects = [effect];
    skill.durationSec = ['gainDp', 'healAllies', 'pushback'].includes(effect.type) ? 0 : 2;
    expect(validateContent(raw).skills.get(skill.id)?.effects).toEqual([effect]);
  });
  it.each(effects)('$type 효과와 맞지 않는 즉시/지속형을 거부한다', (effect) => {
    const raw = makeRawContent();
    const skill = raw.skills[0];
    if (!skill) throw new Error('fixture missing');
    skill.effects = [effect];
    skill.durationSec = ['gainDp', 'healAllies', 'pushback'].includes(effect.type) ? 2 : 0;
    expect(() => validateContent(raw)).toThrow('content/skills[0].effects[0].type');
  });
  it('연속 피해 일정에 못 미치는 지속 시간을 거부한다', () => {
    const raw = makeRawContent();
    const skill = raw.skills[4];
    if (skill) skill.durationSec = 0.9;
    expect(() => validateContent(raw)).toThrow('content/skills[4].durationSec');
  });
  it('연속 피해 마지막 발동 시각과 같은 지속 시간을 허용한다', () => {
    const raw = makeRawContent();
    const skill = raw.skills[4];
    if (skill) skill.durationSec = 1;
    expect(() => validateContent(raw)).not.toThrow();
  });
  it.each([
    ['unknown effect', { type: 'unknown' }, '.type'],
    ['stat', { type: 'statMul', stat: 'hp', value: 2 }, '.stat'],
    ['count', { type: 'pulseDamage', count: 0 }, '.count'],
    ['ratio', { type: 'healAllies', ratioOfMaxHp: 1.1 }, '.ratioOfMaxHp'],
    ['slow', { type: 'onHitSlow', amount: -0.1, sec: 1 }, '.amount'],
    ['hit n', { type: 'stunEveryNthHit', n: 1.5, sec: 1 }, '.n'],
  ] as const)('%s 필드 오류에 경로를 포함한다', (_name, effect, suffix) => {
    const raw = makeRawContent();
    const skill = raw.skills[0];
    const invalid = { ...raw, skills: [{ ...skill, effects: [effect] }, ...raw.skills.slice(1)] };
    expect(() => validateContent(invalid)).toThrow(`content/skills[0].effects[0]${suffix}`);
  });
});
