import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { damageEnemy } from '../../src/sim/systems/damage';
import { updateEnemyMotion } from '../../src/sim/systems/enemyMotion';
import { updateEnemySupport } from '../../src/sim/systems/enemySupport';
import { moveEnemies } from '../../src/sim/systems/movement';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';
import { enemyRosterFixture } from './enemyRosterFixtures';

describe('15종 적의 능력과 대응', () => {
  it.each(['physical', 'magic', 'true'] as const)(
    '%s 피해는 보호막을 먼저 소모하고 초과분만 HP에 적용한다',
    (type) => {
      const f = enemyRosterFixture(['shieldJelly']);
      const enemy = f.state.enemies[0];
      expect(enemy).toBeDefined();
      if (!enemy) throw new Error('적 없음');
      const events: SimEvent[] = [];
      damageEnemy(f.content, f.unit, enemy, 200, type, events);
      expect(enemy.hp).toBe(850);
      expect(enemy.shield).toBeLessThan(500);
      const shield = enemy.shield;
      damageEnemy(f.content, f.unit, enemy, 1000, type, events);
      expect(enemy.shield).toBe(0);
      const last = events[1];
      expect(last?.type).toBe('damage');
      if (last?.type === 'damage') {
        expect(last.shieldDamage).toBe(shield);
        expect(enemy.hp).toBe(850 - (last.amount - shield));
      }
    },
  );

  it('수정젤리는 마법에 강하고 철갑까악은 물리 방어를 가진 비행 적이다', () => {
    const f = enemyRosterFixture(['crystalJelly', 'armoredCrow']);
    const crystal = f.state.enemies[0];
    if (!crystal) throw new Error('수정젤리 없음');
    damageEnemy(f.content, f.unit, crystal, 100, 'magic', []);
    expect(crystal.hp).toBe(915);
    damageEnemy(f.content, f.unit, crystal, 100, 'physical', []);
    expect(crystal.hp).toBe(835);
    expect(content.enemies.get('armoredCrow')).toMatchObject({ flying: true, def: 180 });
  });

  it('돌진의 시작·종료와 둔화·기절을 함께 적용한다', () => {
    const f = enemyRosterFixture(['dashJelly']);
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('적 없음');
    enemy.rushCooldown = 1;
    updateEnemyMotion(f.content, f.state);
    expect(enemy.speedMul).toBe(1.8);
    enemy.slowAmount = 0.5;
    moveEnemies(f.content, f.stage, f.state, []);
    expect(enemy.dist).toBeCloseTo(0.03);
    const cooldown = enemy.rushCooldown;
    enemy.stunUntilTick = 10;
    updateEnemyMotion(f.content, f.state);
    moveEnemies(f.content, f.stage, f.state, []);
    expect(enemy.dist).toBeCloseTo(0.03);
    expect(enemy.rushCooldown).toBe(cooldown);
    f.state.tick = secToTicks(1.2);
    updateEnemyMotion(f.content, f.state);
    expect(enemy.speedMul).toBe(1);
  });

  it('가속 오라는 가장 강한 한 개만 적용하고 이탈·기절·사망 시 해제한다', () => {
    const f = enemyRosterFixture(['drummerJelly', 'drummerJelly', 'jelly']);
    const [a, b, target] = f.state.enemies;
    if (!a || !b || !target) throw new Error('적 없음');
    updateEnemyMotion(f.content, f.state);
    expect(target.speedMul).toBe(1.25);
    target.x = 20;
    updateEnemyMotion(f.content, f.state);
    expect(target.speedMul).toBe(1);
    target.x = 1;
    a.stunUntilTick = 30;
    b.hp = 0;
    updateEnemyMotion(f.content, f.state);
    expect(target.speedMul).toBe(1);
  });

  it('재생은 주기·최대 체력·기절·사망을 지킨다', () => {
    const f = enemyRosterFixture(['sproutJelly']);
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('적 없음');
    enemy.hp = 950;
    enemy.regenCooldown = 2;
    const events: SimEvent[] = [];
    updateEnemySupport(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(950);
    enemy.stunUntilTick = 3;
    updateEnemySupport(f.content, f.stage, f.state, events);
    expect(enemy.regenCooldown).toBe(1);
    f.state.tick = 3;
    updateEnemySupport(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(1000);
    expect(events).toContainEqual({ type: 'enemyHeal', src: enemy.uid, uid: enemy.uid, amount: 50 });
    enemy.hp = 0;
    enemy.regenCooldown = 0;
    updateEnemySupport(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(0);
  });

  it('치유는 사거리 안의 살아 있는 다른 적을 체력 비율·uid 순으로 선택한다', () => {
    const f = enemyRosterFixture(['flowerJelly', 'jelly', 'jelly', 'jelly']);
    const [healer, a, b, outside] = f.state.enemies;
    if (!healer || !a || !b || !outside) throw new Error('적 없음');
    healer.healCooldown = 0;
    a.hp = b.hp = 300;
    outside.hp = 50;
    outside.x = 10;
    updateEnemySupport(f.content, f.stage, f.state, []);
    expect(a.hp).toBe(420);
    expect(b.hp).toBe(300);
    expect(outside.hp).toBe(50);
    healer.healCooldown = 0;
    a.hp = 0;
    updateEnemySupport(f.content, f.stage, f.state, []);
    expect(a.hp).toBe(0);
    expect(b.hp).toBe(420);
  });

  it('소환은 같은 경로의 뒤쪽에서 시작하고 uid·전체 수·최대 횟수를 지킨다', () => {
    const f = enemyRosterFixture(['nestJelly']);
    const source = f.state.enemies[0];
    if (!source) throw new Error('적 없음');
    source.dist = 3;
    const before = f.state.totalEnemies;
    const events: SimEvent[] = [];
    for (let i = 0; i < 5; i++) {
      source.summonCooldown = 0;
      updateEnemySupport(f.content, f.stage, f.state, events);
    }
    expect(f.state.enemies).toHaveLength(4);
    expect(f.state.totalEnemies).toBe(before + 3);
    expect(source.summonsRemaining).toBe(0);
    for (const child of f.state.enemies.slice(1)) {
      expect(child.enemyId).toBe('miniJelly');
      expect(child.routeId).toBe(source.routeId);
      expect(child.dist).toBeCloseTo(2.72);
      expect(child.uid).toBeGreaterThan(source.uid);
      expect(child.summonsRemaining).toBe(0);
    }
    expect(events.filter((event) => event.type === 'enemySpawn')).toHaveLength(3);
  });

  it('살아 있는 소환자의 자식까지 모두 빠져나가야 전투가 끝난다', () => {
    const raw = laneStage(
      [`S${'.'.repeat(38)}G`],
      [{ wave: 1, atSec: 0, enemy: 'nestJelly', count: 1, intervalSec: 0, route: 'ground' }],
      { life: 99 },
    );
    const db = makeContent({ stages: [raw] });
    const battle = createBattle(db, raw.id);
    run(battle, secToTicks(150));
    expect(battle.state).toMatchObject({ phase: 'won', enemies: [], totalEnemies: 4, leaked: 4, life: 95 });
  });

  it('반복 실행과 flush 유무에 따라 적 능력 결과가 달라지지 않는다', () => {
    const execute = (flush: boolean) => {
      const ids = ['dashJelly', 'drummerJelly', 'sproutJelly', 'flowerJelly', 'nestJelly'];
      const raw = laneStage(
        [`S${'.'.repeat(38)}G`, 'H'.repeat(40)],
        ids.map((enemy) => ({ wave: 1, atSec: 0, enemy, count: 1, intervalSec: 0, route: 'ground' })),
        { startDp: 99, life: 99 },
      );
      const battle = createBattle(makeContent({ stages: [raw] }), raw.id);
      const events: SimEvent[] = [];
      for (let tick = 0; tick < 750; tick++) {
        if (tick === 0)
          battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 9, y: 1 }, dir: 'up' });
        if (tick === 360) {
          const unit = battle.state.units[0];
          if (!unit) throw new Error('유닛 없음');
          battle.enqueue({ type: 'activateSkill', uid: unit.uid });
        }
        if (flush) events.push(...battle.flush());
        events.push(...battle.step());
      }
      expect(events.some((event) => event.type === 'commandRejected')).toBe(false);
      return { events, hash: hashState(battle.state) };
    };
    expect(execute(false)).toEqual(execute(true));
  });
});
