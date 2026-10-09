import { describe, expect, it } from 'vitest';
import { assert } from '../../src/core/assert';
import { type Dir, rotateOffset } from '../../src/core/grid';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { unitStats } from '../../src/sim/stats';
import { attackEnemies } from '../../src/sim/systems/attack';
import { applyCommand } from '../../src/sim/systems/commands';
import { updateSkillTimers } from '../../src/sim/systems/skills';
import { pickEnemy } from '../../src/sim/targeting';
import type { BattleState, EnemyEntity, SimEvent } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';

const TILE = { x: 6, y: 6 };
const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;

function fixture(dir: Dir = 'right', tile = TILE) {
  const stage = laneStage(
    Array.from({ length: 13 }, (_, y) =>
      Array.from({ length: 13 }, (_, x) =>
        x === tile.x && y === tile.y ? 'H' : y === 12 && x === 0 ? 'S' : y === 12 && x === 12 ? 'G' : '.',
      ).join(''),
    ),
    [{ wave: 1, atSec: 999, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    { startDp: 99 },
  );
  const db = makeContent({ stages: [stage] });
  const battle = createBattle(db, stage.id);
  battle.enqueue({ type: 'deploy', unitId: 'owl', tile, dir });
  expect(battle.flush()).toContainEqual({ type: 'unitDeploy', uid: 1, unitId: 'owl', tile, dir });
  const unit = battle.state.units[0];
  assert(unit, '부엉이 배치 실패');
  const def = db.units.get('owl');
  const skill = def && db.skills.get(def.skill);
  assert(def && skill, '실제 부엉이 수치 없음');
  return { battle, db, unit, def, skill };
}

function activate(f: ReturnType<typeof fixture>) {
  run(f.battle, secToTicks(f.skill.spCost - f.skill.spStart));
  expect(f.unit.skillState).toBe('ready');
  f.battle.enqueue({ type: 'activateSkill', uid: f.unit.uid });
  expect(f.battle.flush()).toContainEqual({ type: 'skillStart', uid: f.unit.uid, skillId: f.skill.id });
}

function enemy(uid: number, x: number, y: number): EnemyEntity {
  return {
    uid,
    enemyId: 'jelly',
    routeId: 'ground',
    dist: uid,
    segIndex: 0,
    x: x + 0.5,
    y: y + 0.5,
    px: x + 0.5,
    py: y + 0.5,
    hp: 10000,
    maxHp: 10000,
    slowAmount: 0,
    slowUntilTick: 0,
    stunUntilTick: 0,
    abilityCooldown: 0,
  };
}

describe('밤밤의 전방위 사거리와 전면 포격', () => {
  it.each(DIRECTIONS)('%s: 기본 5×5와 스킬 10×10이 정확한 정사각형이다', (dir) => {
    const f = fixture(dir);
    const base = f.battle.rangeTilesFor('owl', TILE, dir);
    expect(base).toHaveLength(25);
    expect(new Set(base.map((tile) => tile.x)).size).toBe(5);
    expect(new Set(base.map((tile) => tile.y)).size).toBe(5);
    expect(base).toContainEqual({ x: 4, y: 4 });
    expect(base).toContainEqual({ x: 8, y: 8 });
    expect(base).toContainEqual(TILE);
    activate(f);
    const expanded = f.battle.rangeTilesFor('owl', TILE, dir);
    expect(expanded).toHaveLength(100);
    expect(new Set(expanded.map((tile) => `${tile.x},${tile.y}`)).size).toBe(100);
    expect(new Set(expanded.map((tile) => tile.x)).size).toBe(10);
    expect(new Set(expanded.map((tile) => tile.y)).size).toBe(10);
    const [frontX, frontY] = rotateOffset([5, 0], dir);
    const [rearX, rearY] = rotateOffset([-4, 0], dir);
    expect(expanded).toContainEqual({ x: TILE.x + frontX, y: TILE.y + frontY });
    expect(expanded).toContainEqual({ x: TILE.x + rearX, y: TILE.y + rearY });
    expect(f.battle.rangeTilesFor('owl', { x: 5, y: 5 }, dir)).toHaveLength(25);
  });

  it.each(DIRECTIONS)('%s: 맵 가장자리에서는 범위 밖 칸을 제외한다', (dir) => {
    const tile = { x: 0, y: 0 };
    const f = fixture(dir, tile);
    const base = f.battle.rangeTilesFor('owl', tile, dir);
    expect(base).toHaveLength(9);
    activate(f);
    const expanded = f.battle.rangeTilesFor('owl', tile, dir);
    expect(expanded.length).toBeGreaterThan(base.length);
    expect(expanded.every(({ x, y }) => x >= 0 && y >= 0 && x < 13 && y < 13)).toBe(true);
  });

  it('발동 중 공격력·공격 속도가 증가하고 만료 경계에서 사거리와 수치를 복원한다', () => {
    const f = fixture();
    expect(unitStats(f.db, f.battle.stage, f.battle.state, f.unit)).toEqual({
      atk: 320,
      atkIntervalTicks: 54,
    });
    activate(f);
    expect(unitStats(f.db, f.battle.stage, f.battle.state, f.unit)).toEqual({
      atk: 480,
      atkIntervalTicks: 27,
    });
    run(f.battle, secToTicks(f.skill.durationSec) - 1);
    expect(f.unit.skillState).toBe('active');
    expect(f.battle.rangeTilesFor('owl', TILE, 'right')).toHaveLength(100);
    const events = run(f.battle, 2);
    expect(events.filter((event) => event.type === 'skillEnd')).toEqual([
      { type: 'skillEnd', uid: f.unit.uid },
    ]);
    expect(f.unit.buffs).toEqual([]);
    expect(f.unit.sp).toBe(0);
    expect(f.battle.rangeTilesFor('owl', TILE, 'right')).toHaveLength(25);
    expect(unitStats(f.db, f.battle.stage, f.battle.state, f.unit)).toEqual({
      atk: 320,
      atkIntervalTicks: 54,
    });
  });

  it('뒤쪽 적도 기본 범위 안이면 공격하고 확대 범위의 적은 스킬 중에만 공격한다', () => {
    const f = fixture();
    const state: BattleState = structuredClone(f.battle.state);
    const unit = state.units[0];
    assert(unit, '공격 검사 유닛 없음');
    const rear = enemy(2, 4, 6);
    const far = enemy(3, 11, 6);
    const outside = enemy(4, 12, 6);
    state.enemies = [rear];
    expect(pickEnemy(f.db, f.battle.stage, state, unit)?.uid).toBe(rear.uid);
    attackEnemies(f.db, f.battle.stage, state, []);
    expect(rear.hp).toBe(9680);
    state.enemies = [far, outside];
    unit.atkCooldown = 0;
    expect(pickEnemy(f.db, f.battle.stage, state, unit)).toBeUndefined();
    unit.sp = f.skill.spCost;
    unit.skillState = 'ready';
    const events: SimEvent[] = [];
    applyCommand(f.db, f.battle.stage, state, { type: 'activateSkill', uid: unit.uid }, events);
    const shots: number[] = [];
    for (state.tick = 0; state.tick <= 54; state.tick++) {
      const batch: SimEvent[] = [];
      attackEnemies(f.db, f.battle.stage, state, batch);
      if (batch.some((event) => event.type === 'attack')) shots.push(state.tick);
    }
    expect(shots).toEqual([0, 27, 54]);
    expect(far.hp).toBe(10000 - 480 * 3);
    expect(outside.hp).toBe(10000);
    state.tick = unit.skillEndTick;
    updateSkillTimers(f.db, f.battle.stage, state, events);
    unit.atkCooldown = 0;
    expect(pickEnemy(f.db, f.battle.stage, state, unit)).toBeUndefined();
  });

  it('스킬 중 후퇴·재배치하면 확대 범위와 공격 버프가 남지 않는다', () => {
    const f = fixture();
    activate(f);
    f.battle.enqueue({ type: 'retreat', uid: f.unit.uid });
    f.battle.flush();
    expect(f.battle.rangeTilesFor('owl', TILE, 'right')).toHaveLength(25);
    run(f.battle, secToTicks(f.def.redeploySec));
    f.battle.enqueue({ type: 'deploy', unitId: 'owl', tile: TILE, dir: 'left' });
    f.battle.flush();
    const replacement = f.battle.unitAt(TILE);
    expect(replacement).toMatchObject({
      sp: f.skill.spStart,
      buffs: [],
      skillState: 'charging',
      atkCooldown: 0,
    });
    expect(replacement?.uid).toBeGreaterThan(f.unit.uid);
    expect(f.battle.rangeTilesFor('owl', TILE, 'left')).toHaveLength(25);
  });

  it('범위 확대·만료를 반복 실행해도 같은 상태 해시를 만든다', () => {
    const execute = () => {
      const f = fixture();
      activate(f);
      const active = hashState(f.battle.state);
      run(f.battle, secToTicks(f.skill.durationSec) + 1);
      return [active, hashState(f.battle.state)];
    };
    expect(execute()).toEqual(execute());
    expect(content.units.get('owl')?.deployOn).toBe('high');
  });
});
