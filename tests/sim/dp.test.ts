import { describe, expect, it } from 'vitest';
import { attackEnemies } from '../../src/sim/systems/attack';
import { applyCommand } from '../../src/sim/systems/commands';
import { removeDead } from '../../src/sim/systems/death';
import { moveEnemies } from '../../src/sim/systems/movement';
import { updateSkillTimers } from '../../src/sim/systems/skills';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN, unitFixture } from './battleFixtures';
import { combatFixture, placeEnemy } from './combatFixtures';
import { skillFixture } from './skillFixtures';

describe('처치로만 얻는 도토리', () => {
  it('초기 자원은 유지하지만 60초 대기와 flush로는 늘지 않는다', () => {
    const { battle } = makeFixture(laneStage(['S.G', 'HHH'], [{ ...SPAWN, atSec: 500 }]));
    expect(battle.state.dp).toBe(10);
    expect(run(battle, 1800).filter((event) => event.type === 'dpGain')).toEqual([]);
    expect(battle.state.dp).toBe(10);
    for (let i = 0; i < 60; i++) battle.flush();
    expect(battle.state).toMatchObject({ tick: 1800, dp: 10 });
  });

  it('실제 사망마다 기본 보상 5개를 한 번만 지급한다', () => {
    const f = combatFixture();
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('enemy');
    enemy.hp = 0;
    const events: SimEvent[] = [];
    removeDead(f.content, f.stage, f.state, events);
    expect(events).toEqual([
      { type: 'enemyDie', uid: enemy.uid },
      { type: 'dpGain', amount: 5, source: 'kill', uid: enemy.uid },
    ]);
    expect(f.state.dp).toBe(15);
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state.killed).toBe(1);
    expect(events).toHaveLength(2);
    expect(f.state.dp).toBe(15);
  });

  it.each([98, 99])('동시 처치에서도 상한 99를 지키고 실제 증가분만 알린다: %s', (dp) => {
    const f = combatFixture();
    const first = placeEnemy(f, 0.5, { hp: 0 });
    const second = placeEnemy(f, 1, { hp: 0 });
    f.state.enemies = [first, second];
    f.state.dp = dp;
    const events: SimEvent[] = [];
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state).toMatchObject({ dp: 99, killed: 2 });
    expect(events.filter((event) => event.type === 'dpGain')).toEqual(
      dp === 98 ? [{ type: 'dpGain', amount: 1, source: 'kill', uid: first.uid }] : [],
    );
  });

  it('적이 살아 있거나 골로 누수되면 보상을 주지 않는다', () => {
    const f = combatFixture();
    const enemy = placeEnemy(f, f.stage.routes.get('ground')?.length ?? 7, { hp: 1 });
    f.state.enemies = [enemy];
    const events: SimEvent[] = [];
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state.dp).toBe(10);
    moveEnemies(f.content, f.stage, f.state, events);
    expect(f.state.leaked).toBe(1);
    expect(f.state.dp).toBe(10);
    expect(events.filter((event) => event.type === 'dpGain')).toEqual([]);
  });

  it.each([0, undefined])('기본 보상 %s인 적은 기본 도토리를 지급하지 않는다', (bounty) => {
    const f = makeFixture(undefined, { bounty });
    const events: SimEvent[] = [];
    spawnEnemies(f.stage, f.state, events);
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('enemy');
    enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state.dp).toBe(10);
    expect(events.filter((event) => event.type === 'dpGain')).toEqual([]);
  });

  it('분열 부모와 자식은 각자 죽어야 5개와 1개씩 지급한다', () => {
    const f = combatFixture();
    f.state.enemies = [placeEnemy(f, 2, { enemyId: 'splitJelly', hp: 0 })];
    const events: SimEvent[] = [];
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state.dp).toBe(15);
    expect(f.state.enemies).toHaveLength(2);
    expect(f.state.enemies.every((enemy) => enemy.enemyId === 'miniJelly')).toBe(true);
    for (const enemy of f.state.enemies) enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state).toMatchObject({ dp: 17, killed: 3 });
    expect(events.filter((event) => event.type === 'dpGain').map((event) => event.amount)).toEqual([5, 1, 1]);
  });

  it('후퇴와 재배치로 도토리를 만들 수 없다', () => {
    const { battle } = makeFixture(laneStage(['S.G', 'HHH'], [{ ...SPAWN, atSec: 500 }], { startDp: 25 }));
    for (let i = 0; i < 2; i++) {
      battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'down' });
      const deployed = battle.flush().find((event) => event.type === 'unitDeploy');
      if (!deployed) throw new Error('deploy');
      const before = battle.state.dp;
      battle.enqueue({ type: 'retreat', uid: deployed.uid });
      expect(battle.flush()).toEqual([{ type: 'unitRetreat', uid: deployed.uid, refund: 0 }]);
      expect(battle.state.dp).toBe(before);
      run(battle, 900);
    }
    expect(battle.state.dp).toBe(7);
  });
});

describe('토리의 전리품 수거', () => {
  it('범위 안에서 다른 아군이 처치해도 보상 2개를 추가한다', () => {
    const f = skillFixture('squirrel');
    f.activate();
    f.unit.atkCooldown = 999;
    f.state.units.push(unitFixture({ uid: 99, unitId: 'cat', tile: { x: 2, y: 1 }, dir: 'up' }));
    f.enemy.hp = 1;
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.events).toContainEqual(
      expect.objectContaining({ type: 'attack', src: { kind: 'unit', uid: 99 } }),
    );
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.dp).toBe(17);
  });

  it('범위 밖의 처치에는 기본 보상만 지급한다', () => {
    const f = skillFixture('squirrel');
    f.activate();
    f.enemy.x = 6.5;
    f.enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.dp).toBe(15);
  });

  it.each([359, 360])('12초 만료 경계인 %s틱에서 유효한 보상만 적용한다', (tick) => {
    const f = skillFixture('squirrel');
    f.activate();
    f.state.tick = tick;
    updateSkillTimers(f.content, f.stage, f.state, f.events);
    f.enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.dp).toBe(tick === 359 ? 17 : 15);
  });

  it('후퇴하면 강화 보상이 사라진다', () => {
    const f = skillFixture('squirrel');
    const slot = f.state.roster.find((entry) => entry.unitId === 'squirrel');
    if (!slot) throw new Error('slot');
    Object.assign(slot, { state: 'deployed', uid: f.unit.uid });
    f.activate();
    applyCommand(f.content, f.stage, f.state, { type: 'retreat', uid: f.unit.uid }, f.events);
    f.enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.dp).toBe(15);
  });

  it('여러 강화가 겹쳐도 최대 추가 보상만 지급한다', () => {
    const f = skillFixture('squirrel');
    f.activate();
    f.unit.buffs.push({ type: 'killBounty', value: 1 }, { type: 'killBounty', value: 3 });
    f.enemy.hp = 0;
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.dp).toBe(18);
  });
});
