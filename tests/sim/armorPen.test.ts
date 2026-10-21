import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { unitStats } from '../../src/sim/stats';
import { attackEnemies } from '../../src/sim/systems/attack';
import { updateSkillTimers } from '../../src/sim/systems/skills';
import { laneStage, makeContent, run } from '../helpers';
import { SPAWN, unitFixture } from './battleFixtures';
import { placeEnemy } from './combatFixtures';
import { skillFixture } from './skillFixtures';

function fixture(unitId: string, armorPen: number) {
  const f = skillFixture(unitId);
  const def = f.content.units.get(unitId);
  const enemyDef = f.content.enemies.get('jelly');
  if (!def || !enemyDef) throw new Error('관통 fixture 없음');
  def.armorPen = armorPen;
  enemyDef.def = 300;
  return { ...f, def, enemyDef };
}

describe('관통 공격·스킬', () => {
  it('일반 공격에 관통력을 적용한다', () => {
    const f = fixture('squirrel', 100);
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.hp).toBe(9920);
    expect(f.events).toContainEqual(expect.objectContaining({ type: 'damage', amount: 80 }));
  });
  it('한 친구의 관통 스킬은 적 방어력이나 다른 친구의 피해를 바꾸지 않는다', () => {
    const f = fixture('squirrel', 0);
    f.skill.effects = [{ type: 'armorPenAdd', value: 100 }];
    f.activate();
    f.state.units.push(unitFixture({ uid: 20, dir: 'up' }));
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((event) => event.type === 'damage').map((event) => event.amount)).toEqual([
      80, 14,
    ]);
    expect(f.enemyDef.def).toBe(300);
  });
  it('관통 증가를 합산하되 공격 배율은 공격력에만 적용하고 만료 시 복원한다', () => {
    const f = fixture('squirrel', 60);
    f.skill.effects = [
      { type: 'armorPenAdd', value: 40 },
      { type: 'armorPenAdd', value: 20 },
      { type: 'statMul', stat: 'atk', value: 1.5 },
    ];
    f.activate();
    expect(unitStats(f.content, f.stage, f.state, f.unit)).toMatchObject({ atk: 420, armorPen: 120 });
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.hp).toBe(9760);
    f.state.tick = f.unit.skillEndTick;
    updateSkillTimers(f.content, f.stage, f.state, f.events);
    expect(unitStats(f.content, f.stage, f.state, f.unit)).toMatchObject({ atk: 280, armorPen: 60 });
  });
  it('보호막은 관통 계산 후 피해를 흡수하고 남은 피해만 체력에 적용한다', () => {
    const f = fixture('squirrel', 100);
    f.def.atk = 400;
    f.enemyDef.def = 140;
    f.enemy.shield = 600;
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy).toMatchObject({ shield: 240, hp: 10000 });
    f.unit.atkCooldown = 0;
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy).toMatchObject({ shield: 0, hp: 9880 });
    expect(f.events.filter((event) => event.type === 'damage').map((event) => event.shieldDamage)).toEqual([
      360, 240,
    ]);
  });
  it('범위 공격은 각 적의 방어력에 관통 전체를 적용한다', () => {
    const f = fixture('penguin', 80);
    const nearby = placeEnemy(f, 1, { enemyId: 'armoredCrow', hp: 5000 });
    f.state.enemies.push(nearby);
    f.activate();
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.hp).toBe(9840);
    expect(nearby.hp).toBe(4720);
  });
  it('삼중 사격은 적마다 160 관통을 적용하고 한 명이면 한 발만 쏜다', () => {
    const f = fixture('wolf', 120);
    f.enemyDef.def = 30;
    const air = placeEnemy(f, 1, { enemyId: 'armoredCrow', hp: 5000 });
    const hard = placeEnemy(f, 1.2, { enemyId: 'hardJelly', hp: 5000 });
    f.state.enemies.push(air, hard);
    f.activate();
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect([f.enemy.hp, air.hp, hard.hp]).toEqual([9415, 4435, 4555]);
    expect(f.events.filter((event) => event.type === 'attack')).toHaveLength(3);
    f.state.enemies = [hard];
    f.unit.atkCooldown = 0;
    f.events.length = 0;
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((event) => event.type === 'attack')).toHaveLength(1);
    expect(hard.hp).toBe(4110);
  });
  it.each(['physical', 'magic'] as const)('%s 스킬 펄스도 같은 관통 규칙을 사용한다', (damageType) => {
    const f = fixture('sheep', 50);
    f.enemyDef.res = 20;
    f.skill.durationSec = 1;
    f.skill.effects = [
      { type: 'armorPenAdd', value: 50 },
      { type: 'pulseDamage', count: 2, intervalSec: 0.5, atkMul: 1.3, damageType },
    ];
    f.activate();
    f.state.tick = 15;
    updateSkillTimers(f.content, f.stage, f.state, f.events);
    const amount = damageType === 'physical' ? 346 : 436.8;
    expect(f.enemy.hp).toBeCloseTo(10000 - amount * 2);
    expect(f.events.filter((event) => event.type === 'damage')).toHaveLength(2);
    f.state.tick = 30;
    updateSkillTimers(f.content, f.stage, f.state, f.events);
    expect(unitStats(f.content, f.stage, f.state, f.unit).armorPen).toBe(50);
  });
  it('자연 충전 스킬 후 후퇴·재배치하면 기본 관통력으로 돌아온다', () => {
    const stage = laneStage(['S....G', 'HHHHHH'], [{ ...SPAWN, atSec: 1000 }], { startDp: 99 });
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    battle.enqueue({ type: 'deploy', unitId: 'wolf', tile: { x: 1, y: 1 }, dir: 'up' });
    battle.flush();
    run(battle, 601);
    const unit = battle.state.units[0];
    if (!unit) throw new Error('랑랑 배치 실패');
    battle.enqueue({ type: 'activateSkill', uid: unit.uid });
    battle.flush();
    expect(unitStats(battle.content, battle.stage, battle.state, unit).armorPen).toBe(160);
    battle.enqueue({ type: 'retreat', uid: unit.uid });
    battle.flush();
    run(battle, 1501);
    battle.enqueue({ type: 'deploy', unitId: 'wolf', tile: { x: 1, y: 1 }, dir: 'up' });
    battle.flush();
    const next = battle.state.units[0];
    if (!next) throw new Error('랑랑 재배치 실패');
    expect(next.buffs).toEqual([]);
    expect(unitStats(battle.content, battle.stage, battle.state, next).armorPen).toBe(120);
  });
});
