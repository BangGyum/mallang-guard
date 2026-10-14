import { describe, expect, it } from 'vitest';
import type { Dir } from '../../src/core/grid';
import { secToTicks } from '../../src/sim/constants';
import { unitStats } from '../../src/sim/stats';
import { attackEnemies } from '../../src/sim/systems/attack';
import { removeDead } from '../../src/sim/systems/death';
import type { SimEvent } from '../../src/sim/types';
import { run } from '../helpers';
import { LINE_TILE, lineEnemy } from './lineSniperFixtures';
import { rareFixture } from './rareFixtures';

function attack(f: ReturnType<typeof rareFixture>) {
  const events: SimEvent[] = [];
  attackEnemies(f.content, f.stage, f.state, events);
  return {
    events,
    damage: events.filter((event) => event.type === 'damage'),
    shots: events.filter((event) => event.type === 'attack'),
  };
}

describe('희귀 3종의 자동 공격', () => {
  it('루아는 사거리 안 보스를 우선하고 사거리 밖/죽은 보스를 제외한다', () => {
    const f = rareFixture('fox');
    f.state.enemies = [
      lineEnemy(10, 5),
      { ...lineEnemy(11, 2), enemyId: 'bigJelly' },
      { ...lineEnemy(12, 6), enemyId: 'bigJelly' },
      { ...lineEnemy(13, 3), enemyId: 'bigJelly', hp: 0 },
    ];
    expect(attack(f).shots.map((event) => event.dst.uid)).toEqual([11]);
    f.unit.atkCooldown = 0;
    f.state.enemies = f.state.enemies.filter((enemy) => enemy.uid !== 11);
    expect(attack(f).shots.map((event) => event.dst.uid)).toEqual([10]);
  });
  it('루아의 같은 보스 우선순위는 남은 경로와 uid로 결정한다', () => {
    const f = rareFixture('fox');
    f.state.enemies = [20, 11, 12].map((uid) => ({
      ...lineEnemy(uid, uid === 12 ? 3 : 4),
      enemyId: 'bigJelly',
    }));
    expect(attack(f).shots[0]?.dst.uid).toBe(11);
  });
  it.each([false, true])('루아 스킬 %s에서 방어력 600을 관통 220/400으로 계산한다', (active) => {
    const f = rareFixture('fox', active);
    const original = f.content.enemies.get('jelly');
    if (!original) throw new Error('젤리 없음');
    f.content = { ...f.content, enemies: new Map(f.content.enemies).set('jelly', { ...original, def: 600 }) };
    f.state.enemies = [lineEnemy(10, 3)];
    expect(attack(f).damage[0]?.amount).toBe(active ? 1240 : 520);
    expect(unitStats(f.content, f.stage, f.state, f.unit).armorPen).toBe(active ? 400 : 220);
  });
  it.each([false, true])('로크 스킬 %s에서 반경 1.2/1.8만 맞히고 비행 적을 제외한다', (active) => {
    const f = rareFixture('redPanda', active);
    f.state.enemies = [
      lineEnemy(10, 4),
      lineEnemy(11, 3),
      lineEnemy(12, 2.4),
      { ...lineEnemy(13, 4, 1), enemyId: 'crow', routeId: 'air' },
    ];
    const result = attack(f);
    expect(result.shots.map((event) => event.dst.uid)).toEqual([10]);
    expect(result.damage.map((event) => event.dst.uid)).toEqual(active ? [10, 11, 12] : [10, 11]);
    expect(result.damage.map((event) => event.amount)).toEqual(active ? [784, 784, 784] : [560, 560]);
    expect(f.unit.atkCooldown).toBe(active ? 45 : 72);
  });
  it('로크는 공중 적만 있으면 발사·쿨다운·공격 횟수를 소비하지 않는다', () => {
    const f = rareFixture('redPanda');
    f.state.enemies = [{ ...lineEnemy(10, 3), enemyId: 'crow', routeId: 'air' }];
    expect(attack(f).events).toEqual([]);
    expect(f.unit.atkCooldown).toBe(0);
  });
  it.each([false, true])('세라 스킬 %s에서 3/5명, 감소 피해와 연결 출처를 기록한다', (active) => {
    const f = rareFixture('deer', active);
    f.state.enemies = [
      lineEnemy(10, 4),
      lineEnemy(11, 3),
      lineEnemy(12, 2),
      lineEnemy(13, 1),
      lineEnemy(14, 1, 1),
    ];
    const result = attack(f);
    const expectedDamage = active ? [360, 288, 216, 144, 108] : [360, 252, 180];
    expect(result.damage).toHaveLength(expectedDamage.length);
    for (const [index, amount] of expectedDamage.entries())
      expect(result.damage[index]?.amount).toBeCloseTo(amount, 10);
    expect(result.shots.map((event) => event.chainFrom)).toEqual(
      active ? [undefined, 10, 11, 12, 13] : [undefined, 10, 11],
    );
    expect(new Set(result.shots.map((event) => event.dst.uid)).size).toBe(result.shots.length);
    expect(result.shots.every((event) => event.src.uid === f.unit.uid && event.damageType === 'magic')).toBe(
      true,
    );
    expect(f.unit.atkCooldown).toBe(active ? 30 : 45);
    expect(f.unit.skillHitCount).toBe(active ? 1 : 0);
  });
  it('세라는 혼자 온 적을 한 번만 공격하고 연결 거리를 넘으면 멈춘다', () => {
    for (const enemies of [[lineEnemy(10, 4)], [lineEnemy(10, 4), lineEnemy(11, 2)]]) {
      const f = rareFixture('deer', true);
      f.state.enemies = enemies;
      expect(attack(f).shots.map((event) => event.dst.uid)).toEqual([10]);
    }
  });
  it('연쇄는 사거리 밖/죽은 적으로 넘어가지 않고 동일 거리에서는 uid 순이다', () => {
    const f = rareFixture('deer');
    f.state.enemies = [
      lineEnemy(10, 4),
      lineEnemy(22, 3, 1),
      lineEnemy(11, 3, -1),
      lineEnemy(12, 5),
      { ...lineEnemy(13, 3), hp: 0 },
    ];
    expect(attack(f).shots.map((event) => event.dst.uid)).toEqual([10, 11]);
  });
  it('첫 적이 즉사해도 정해진 연쇄는 이어지고 처치 보상은 한 번만 준다', () => {
    const f = rareFixture('deer');
    f.state.enemies = [lineEnemy(10, 4), lineEnemy(11, 3), lineEnemy(12, 2)].map((enemy) => ({
      ...enemy,
      hp: 1,
    }));
    const { events } = attack(f);
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(3);
    removeDead(f.content, f.stage, f.state, events);
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state.killed).toBe(3);
    expect(events.filter((event) => event.type === 'enemyDie')).toHaveLength(3);
    expect(events.filter((event) => event.type === 'dpGain')).toHaveLength(3);
  });
  it('연쇄 각 적에 마법 저항/보호막을 적용하고 공격 SP는 한 번만 충전한다', () => {
    const f = rareFixture('deer');
    const original = f.content.enemies.get('jelly');
    if (!original) throw new Error('젤리 없음');
    f.content = {
      ...f.content,
      enemies: new Map(f.content.enemies).set('jelly', { ...original, res: 50 }),
      skills: new Map(f.content.skills).set(f.skill.id, { ...f.skill, charge: 'attack' }),
    };
    f.state.enemies = [lineEnemy(10, 4), { ...lineEnemy(11, 3), shield: 100 }, lineEnemy(12, 2)];
    const result = attack(f);
    expect(result.damage).toHaveLength(3);
    for (const [index, amount] of [180, 126, 90].entries())
      expect(result.damage[index]?.amount).toBeCloseTo(amount, 10);
    expect(result.damage[1]?.shieldDamage).toBe(100);
    expect(f.state.enemies[1]?.hp).toBe(9974);
    expect(f.unit.sp).toBe(11);
  });
  it.each(['right', 'down', 'left', 'up'] satisfies Dir[])(
    '세라의 %s 방향 사거리와 연결은 회전한다',
    (dir) => {
      const f = rareFixture('deer', false, dir);
      f.state.enemies = [lineEnemy(10, 4, 0, dir), lineEnemy(11, 3, 0, dir), lineEnemy(12, 5, 0, dir)];
      expect(attack(f).shots.map((event) => event.dst.uid)).toEqual([10, 11]);
      expect(f.battle.rangeTilesFor('deer', LINE_TILE, dir)).toHaveLength(12);
    },
  );
  it.each(['fox', 'redPanda', 'deer'])('%s의 스킬 종료·후퇴·재배치는 기본 수치를 복원한다', (id) => {
    const f = rareFixture(id, true);
    run(f.battle, secToTicks(f.skill.durationSec) + 1);
    const unit = f.battle.state.units[0];
    if (!unit) throw new Error('유닛 없음');
    expect(unit.skillState).toBe('charging');
    expect(unit.buffs).toEqual([]);
    expect(unitStats(f.content, f.stage, f.battle.state, unit)).toEqual({
      atk: f.def.atk,
      armorPen: f.def.armorPen ?? 0,
      atkIntervalTicks: secToTicks(f.def.atkIntervalSec),
    });
    const dp = f.battle.state.dp;
    f.battle.enqueue({ type: 'retreat', uid: unit.uid });
    f.battle.flush();
    expect(f.battle.state.dp).toBe(dp);
    run(f.battle, secToTicks(f.def.redeploySec));
    f.battle.enqueue({ type: 'deploy', unitId: id, tile: LINE_TILE, dir: 'right' });
    f.battle.flush();
    expect(f.battle.state.units[0]).toMatchObject({
      sp: f.skill.spStart,
      skillState: 'charging',
      buffs: [],
      skillHitCount: 0,
    });
    expect(f.battle.state.dp).toBe(dp - f.def.cost);
  });
});
