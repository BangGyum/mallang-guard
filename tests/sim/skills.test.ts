import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { unitStats } from '../../src/sim/stats';
import { attackEnemies } from '../../src/sim/systems/attack';
import { applyCommand } from '../../src/sim/systems/commands';
import { updateSkills, updateSkillTimers } from '../../src/sim/systems/skills';
import { updateStatus } from '../../src/sim/systems/status';
import { laneStage, makeContent, run } from '../helpers';
import { SPAWN, unitFixture } from './battleFixtures';
import { placeEnemy } from './combatFixtures';
import { skillFixture } from './skillFixtures';

describe('스킬 충전·명령', () => {
  it('12초 자동 충전 뒤 한 번만 준비되며 flush는 시간을 진행하지 않는다', () => {
    const stage = laneStage(['S...G', 'HHHHH'], [{ ...SPAWN, atSec: 500 }]);
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
    battle.flush();
    expect(run(battle, 359).filter((e) => e.type === 'skillReady')).toEqual([]);
    expect(battle.step()).toContainEqual({ type: 'skillReady', uid: 1 });
    expect(run(battle, 60).filter((e) => e.type === 'skillReady')).toEqual([]);
    const tick = battle.state.tick;
    const dp = battle.state.dp;
    battle.enqueue({ type: 'activateSkill', uid: 1 });
    battle.flush();
    expect(battle.state.tick).toBe(tick);
    expect(battle.state.dp).toBe(dp + 12);
    expect(battle.state.units[0]).toMatchObject({ sp: 0, skillState: 'charging' });
  });
  it('배치 시 SP가 가득 찬 스킬은 같은 flush에서 발동 가능하다', () => {
    const f = skillFixture('squirrel');
    f.skill.spStart = f.skill.spCost;
    const battle = createBattle(f.content, f.stage.definition.id);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
    battle.enqueue({ type: 'activateSkill', uid: 1 });
    expect(battle.flush().map((e) => e.type)).toEqual([
      'unitDeploy',
      'skillReady',
      'skillStart',
      'dpGain',
      'skillEnd',
    ]);
  });
  it.each(['skillNotReady', 'noTarget', 'autoSkill', 'notDeployed', 'ended'] as const)(
    '%s 거부 시 상태가 변하지 않는다',
    (reason) => {
      const f = skillFixture(reason === 'autoSkill' ? 'bunny' : 'sheep');
      if (reason === 'skillNotReady') f.unit.skillState = 'charging';
      if (reason === 'noTarget') f.state.enemies = [];
      if (reason === 'notDeployed') f.state.units = [];
      if (reason === 'ended') f.state.phase = 'won';
      const before = structuredClone(f.state);
      f.activate();
      expect(f.events[0]).toMatchObject({ type: 'commandRejected', reason });
      expect(f.state).toEqual(before);
    },
  );
  it('공격 충전은 실제 공격 12회에 준비되고 스킬 중에는 충전하지 않는다', () => {
    const f = skillFixture('cat');
    f.unit.sp = 0;
    f.unit.skillState = 'charging';
    for (let i = 0; i < 12; i++) {
      f.unit.atkCooldown = 0;
      attackEnemies(f.content, f.stage, f.state, f.events);
      expect(f.unit.sp).toBe(i + 1);
    }
    expect(f.events.filter((e) => e.type === 'skillReady')).toHaveLength(1);
    f.activate();
    f.unit.atkCooldown = 0;
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.unit.sp).toBe(12);
  });
});

describe('캐릭터별 스킬', () => {
  it.each([10, 95, 99])('토리는 도토리 %s에서 최대 99까지만 지급한다', (dp) => {
    const f = skillFixture('squirrel');
    f.state.dp = dp;
    f.state.dpTicks = 15;
    f.activate();
    expect(f.state.dp).toBe(Math.min(99, dp + 12));
    expect(f.unit).toMatchObject({ sp: 0, skillState: 'charging' });
    if (dp >= 95) expect(f.state.dpTicks).toBe(0);
    expect(f.events.filter((e) => e.type === 'dpGain')).toEqual(
      dp === 99 ? [] : [{ type: 'dpGain', amount: Math.min(12, 99 - dp), source: 'skill' }],
    );
  });
  it('냥기사는 2배속으로 공격하고 세 번째마다 주 대상을 기절시킨다', () => {
    const f = skillFixture('cat');
    f.activate();
    expect(unitStats(f.content, f.stage, f.state, f.unit).atkIntervalTicks).toBe(18);
    for (let i = 1; i <= 3; i++) {
      f.unit.atkCooldown = 0;
      attackEnemies(f.content, f.stage, f.state, f.events);
      expect(f.enemy.stunUntilTick).toBe(i === 3 ? 15 : 0);
    }
    f.state.tick = 240;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.unit).toMatchObject({ sp: 0, skillState: 'charging', buffs: [] });
    expect(unitStats(f.content, f.stage, f.state, f.unit).atkIntervalTicks).toBe(36);
  });
  it('뚜껑곰은 공격력이 증가하고 매 공격마다 기절시킨다', () => {
    const f = skillFixture('bear');
    f.activate();
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.hp).toBe(10000 - (220 * 1.8 - 50));
    expect(f.enemy.stunUntilTick).toBe(18);
  });
  it('펭펭은 범위 피해·둔화를 적용하고 반경 밖 적은 제외한다', () => {
    const f = skillFixture('penguin');
    const nearby = placeEnemy(f, 1, { enemyId: 'crow', routeId: 'air', hp: 5000 });
    const outside = placeEnemy(f, 3, { hp: 5000 });
    f.state.enemies.push(nearby, outside);
    f.activate();
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.hp).toBe(9670);
    expect(nearby.hp).toBe(4650);
    expect(outside.hp).toBe(5000);
    expect([f.enemy.slowAmount, nearby.slowAmount, outside.slowAmount]).toEqual([0.3, 0.3, 0]);
  });
  it.each([1, 1.5])('몽실은 0·15·30틱에 펄스를 내고 지속시간 %s초 종료 경계도 지킨다', (duration) => {
    const f = skillFixture('sheep');
    f.skill.durationSec = duration;
    f.activate();
    const pulseTicks = [0];
    for (let tick = 1; tick <= duration * 30; tick++) {
      f.state.tick = tick;
      const from = f.events.length;
      updateSkillTimers(f.content, f.stage, f.state, f.events);
      if (f.events.slice(from).some((e) => e.type === 'skillPulse')) pulseTicks.push(tick);
    }
    expect(pulseTicks).toEqual([0, 15, 30]);
    expect(f.enemy.hp).toBeCloseTo(10000 - 420 * 1.3 * 3);
    expect(f.unit).toMatchObject({ sp: 0, skillState: 'charging', buffs: [], pulsesLeft: 0 });
  });
  it('토실은 적이 올 때 자동 발동해 범위 안 친구들의 공격 간격만 줄인다', () => {
    const f = skillFixture('bunny');
    const ally = unitFixture({ uid: 20, tile: { x: 2, y: 1 } });
    const outside = unitFixture({ uid: 21, tile: { x: 5, y: 1 } });
    f.state.units.push(ally, outside);
    f.state.enemies = [];
    updateSkills(f.content, f.stage, f.state, f.events);
    expect(f.unit.skillState).toBe('ready');
    f.state.enemies = [f.enemy];
    updateSkills(f.content, f.stage, f.state, f.events);
    expect(f.unit.skillState).toBe('active');
    expect(unitStats(f.content, f.stage, f.state, ally).atkIntervalTicks).toBe(21);
    expect(unitStats(f.content, f.stage, f.state, outside).atkIntervalTicks).toBe(30);
    f.state.tick = 240;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(unitStats(f.content, f.stage, f.state, ally).atkIntervalTicks).toBe(30);
  });
  it('굴굴은 적을 경로 처음까지만 밀고 좌표·구간 캐시를 함께 갱신한다', () => {
    const f = skillFixture('mole');
    f.activate();
    expect(f.enemy).toMatchObject({ dist: 0, x: 0.5, y: 0.5, px: 0.5, py: 0.5, segIndex: 0 });
    expect(f.unit.skillState).toBe('charging');
  });
  it('끈끈은 기본 공격에 둔화 특성이 있고 스킬은 범위를 벗어나면 풀린다', () => {
    const f = skillFixture('snail');
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy).toMatchObject({ slowAmount: 0.2, slowUntilTick: 24 });
    f.activate();
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.enemy.slowAmount).toBe(0.6);
    f.enemy.x = 6.5;
    f.state.tick += 1;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.enemy.slowAmount).toBe(0);
  });
  it('발동 중 후퇴하면 남은 펄스와 아군 버프도 사라진다', () => {
    const f = skillFixture('sheep');
    const slot = f.state.roster.find((entry) => entry.unitId === 'sheep');
    if (!slot) throw new Error('slot');
    slot.state = 'deployed';
    slot.uid = f.unit.uid;
    f.activate();
    applyCommand(f.content, f.stage, f.state, { type: 'retreat', uid: f.unit.uid }, f.events);
    f.state.tick = 30;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((e) => e.type === 'skillPulse')).toHaveLength(1);
    expect(f.state.units).toEqual([]);
  });
});
