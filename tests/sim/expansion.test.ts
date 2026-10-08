import { describe, expect, it } from 'vitest';
import type { EnemyDef } from '../../src/data/types';
import { createBattle } from '../../src/sim/battle';
import { unitStats } from '../../src/sim/stats';
import { removeDead } from '../../src/sim/systems/death';
import { updateEnemyAbilities } from '../../src/sim/systems/enemyAbilities';
import { checkOutcome } from '../../src/sim/systems/outcome';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import { updateStatus } from '../../src/sim/systems/status';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';
import { makeFixture, SPAWN, unitFixture } from './battleFixtures';

function specialFixture(enemy: string) {
  const f = makeFixture(laneStage(['S......G', 'HHHHHHHH'], [{ ...SPAWN, enemy }]));
  const events: SimEvent[] = [];
  spawnEnemies(f.stage, f.state, events);
  return { ...f, events };
}

describe('분열젤리', () => {
  it('부모를 정리하고 같은 경로에 자식을 uid 순으로 추가하며 승리를 기다린다', () => {
    const f = specialFixture('splitJelly');
    const parent = f.state.enemies[0];
    if (!parent) throw new Error('fixture');
    parent.dist = 2;
    parent.hp = 0;
    f.events.length = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    checkOutcome(f.stage, f.state, f.events);
    expect(f.state).toMatchObject({ killed: 1, totalEnemies: 3, phase: 'running' });
    expect(f.state.enemies.map((enemy) => [enemy.uid, enemy.enemyId, enemy.dist])).toEqual([
      [2, 'miniJelly', 2],
      [3, 'miniJelly', 1.72],
    ]);
    expect(f.state.enemies.every((enemy) => enemy.hp === 200 && enemy.px === enemy.x)).toBe(true);
    expect(f.events.map((event) => event.type)).toEqual(['enemyDie', 'enemySpawn', 'enemySpawn']);
    for (const enemy of f.state.enemies) enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    checkOutcome(f.stage, f.state, f.events);
    expect(f.state).toMatchObject({ killed: 3, totalEnemies: 3, enemies: [], phase: 'won' });
  });
  it('입구에서 분열해도 자식을 음수 거리에 만들지 않고 중복 생성하지 않는다', () => {
    const f = specialFixture('splitJelly');
    for (const enemy of f.state.enemies) enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.enemies.map((enemy) => enemy.dist)).toEqual([0, 0]);
    expect(f.state.totalEnemies).toBe(3);
  });
  it('누수한 부모는 분열하지 않는다', () => {
    const stage = laneStage(['S.G'], [{ ...SPAWN, enemy: 'splitJelly' }]);
    const content = makeContent();
    const raw = makeContent({
      stages: [stage],
      enemies: [...content.enemies.values()].map((enemy) => ({ ...enemy, speed: 90 })),
    });
    const battle = createBattle(raw, stage.id);
    const events = run(battle, 2);
    expect(events.filter((event) => event.type === 'enemySpawn')).toHaveLength(1);
    expect(battle.state).toMatchObject({ totalEnemies: 1, leaked: 1, killed: 0 });
  });
});

describe('적의 공격 방해', () => {
  it('가장 가까운 친구 하나를 고르며 거리 동점은 uid 순서다', () => {
    const f = specialFixture('spitter');
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('fixture');
    enemy.abilityCooldown = 0;
    f.state.units = [
      unitFixture({ uid: 8, tile: { x: 1, y: 0 } }),
      unitFixture({ uid: 7, tile: { x: 0, y: 1 } }),
    ];
    f.events.length = 0;
    updateEnemyAbilities(f.content, f.state, f.events);
    expect(f.events).toEqual([{ type: 'unitDisrupt', src: enemy.uid, uid: 7, untilTick: 66 }]);
    expect(f.state.units[0]?.disruptedUntilTick).toBe(0);
    expect(f.state.units[1]).toMatchObject({ disruptionMul: 1.5, disruptedUntilTick: 66 });
    expect(f.state.units[1]).not.toHaveProperty('hp');
    expect(enemy.abilityCooldown).toBe(210);
  });
  it('범위 밖에는 발사하지 않고 기절 중에는 충전도 멈춘다', () => {
    const f = specialFixture('spitter');
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('fixture');
    enemy.abilityCooldown = 0;
    f.state.units = [unitFixture({ tile: { x: 6, y: 1 } })];
    f.events.length = 0;
    updateEnemyAbilities(f.content, f.state, f.events);
    expect(f.events).toEqual([]);
    expect(enemy.abilityCooldown).toBe(0);
    enemy.abilityCooldown = 10;
    enemy.stunUntilTick = 30;
    updateEnemyAbilities(f.content, f.state, f.events);
    expect(enemy.abilityCooldown).toBe(10);
    f.state.tick = 30;
    updateEnemyAbilities(f.content, f.state, f.events);
    expect(enemy.abilityCooldown).toBe(9);
  });
  it('왕젤리는 셋까지 방해하고 강한 배율·긴 시간을 유지하며 만료한다', () => {
    const f = specialFixture('kingJelly');
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('fixture');
    enemy.abilityCooldown = 0;
    f.state.units = [0, 1, 2, 3].map((x) => unitFixture({ uid: x + 2, tile: { x, y: 1 } }));
    const first = f.state.units[0];
    if (!first) throw new Error('fixture');
    first.disruptedUntilTick = 100;
    first.disruptionMul = 2;
    f.events.length = 0;
    updateEnemyAbilities(f.content, f.state, f.events);
    expect(f.events).toHaveLength(3);
    expect(first).toMatchObject({ disruptedUntilTick: 100, disruptionMul: 2 });
    expect(unitStats(f.content, f.stage, f.state, first).atkIntervalTicks).toBe(60);
    first.buffs = [{ type: 'statMul', stat: 'atkInterval', value: 0.5 }];
    expect(unitStats(f.content, f.stage, f.state, first).atkIntervalTicks).toBe(30);
    f.state.tick = 100;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(first).toMatchObject({ disruptedUntilTick: 0, disruptionMul: 1 });
    expect(unitStats(f.content, f.stage, f.state, first).atkIntervalTicks).toBe(15);
  });
  it('후퇴 후 다시 배치한 친구는 방해 상태를 이어받지 않는다', () => {
    const stage = laneStage(['S......G', 'HHHHHHHH'], [{ ...SPAWN, enemy: 'spitter' }]);
    const content = makeContent();
    const enemies = [...content.enemies.values()].map(
      (enemy): EnemyDef => ({ ...enemy, speed: 0.001, hp: 100000 }),
    );
    const battle = createBattle(makeContent({ stages: [stage], enemies }), stage.id);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 0, y: 1 }, dir: 'up' });
    run(battle, 211);
    const unit = battle.state.units[0];
    expect(unit?.disruptedUntilTick).toBeGreaterThan(battle.state.tick);
    battle.enqueue({ type: 'retreat', uid: unit?.uid ?? -1 });
    run(battle, 901);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 0, y: 1 }, dir: 'up' });
    battle.flush();
    expect(battle.state.units[0]).toMatchObject({ disruptedUntilTick: 0, disruptionMul: 1 });
  });
});
