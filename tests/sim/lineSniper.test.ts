import { describe, expect, it } from 'vitest';
import { assert } from '../../src/core/assert';
import { rotateOffset } from '../../src/core/grid';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { unitStats } from '../../src/sim/stats';
import { attackEnemies } from '../../src/sim/systems/attack';
import { updateSkillTimers } from '../../src/sim/systems/skills';
import { pickEnemies } from '../../src/sim/targeting';
import type { BattleState, SimEvent } from '../../src/sim/types';
import { run } from '../helpers';
import { activateLine, LINE_TILE, lineBattle, lineEnemy } from './lineSniperFixtures';

const DIRS = ['right', 'down', 'left', 'up'] as const;

function shooting(active = true) {
  const f = lineBattle();
  if (active) activateLine(f);
  const state: BattleState = structuredClone(f.battle.state);
  const unit = state.units[0];
  assert(unit, '사격 유닛 없음');
  return { ...f, state, unit };
}

describe('랑랑의 정면 집중 사격과 삼중 조준', () => {
  it.each(DIRS)('%s: 자신의 앞 5×1칸에서 5×3칸으로 확대한다', (dir) => {
    const f = lineBattle(dir);
    const forward = Array.from({ length: 5 }, (_, index) => {
      const [dx, dy] = rotateOffset([index + 1, 0], dir);
      return { x: LINE_TILE.x + dx, y: LINE_TILE.y + dy };
    });
    expect(f.battle.rangeTilesFor('wolf', LINE_TILE, dir)).toEqual(forward);
    activateLine(f);
    const expanded = f.battle.rangeTilesFor('wolf', LINE_TILE, dir);
    expect(expanded).toHaveLength(15);
    expect(new Set(expanded.map(({ x, y }) => `${x},${y}`)).size).toBe(15);
    for (const dx of [1, 2, 3, 4, 5])
      for (const dy of [-1, 0, 1]) {
        const [x, y] = rotateOffset([dx, dy], dir);
        expect(expanded).toContainEqual({ x: LINE_TILE.x + x, y: LINE_TILE.y + y });
      }
    expect(expanded).not.toContainEqual(LINE_TILE);
    const [backX, backY] = rotateOffset([-1, 0], dir);
    expect(expanded).not.toContainEqual({ x: LINE_TILE.x + backX, y: LINE_TILE.y + backY });
  });

  it.each(DIRS)('%s: 모서리에서는 맵 밖 칸을 제외한다', (dir) => {
    const tile = { x: 0, y: 0 };
    const f = lineBattle(dir, tile);
    expect(f.battle.rangeTilesFor('wolf', tile, dir)).toHaveLength(dir === 'right' || dir === 'down' ? 5 : 0);
    activateLine(f);
    const tiles = f.battle.rangeTilesFor('wolf', tile, dir);
    expect(tiles).toHaveLength(dir === 'right' || dir === 'down' ? 10 : 0);
    expect(tiles.every(({ x, y }) => x >= 0 && y >= 0 && x < 13 && y < 13)).toBe(true);
  });

  it('기본 공격은 정면 한 명에게만 강한 피해를 주고 옆·뒤·6번째 칸을 제외한다', () => {
    const f = shooting(false);
    f.state.enemies = [
      lineEnemy(10, 1),
      lineEnemy(11, 5),
      lineEnemy(12, 2, 1),
      lineEnemy(13, -1),
      lineEnemy(14, 6),
    ];
    const events: SimEvent[] = [];
    attackEnemies(f.db, f.battle.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack').map((event) => event.dst.uid)).toEqual([11]);
    expect(f.state.enemies.map((enemy) => enemy.hp)).toEqual([10000, 9400, 10000, 10000, 10000]);
    expect(f.unit.atkCooldown).toBe(72);
  });

  it.each([0, 1, 2, 3, 4])('스킬 범위 안에 %i명이 있으면 서로 다른 적에게 최대 세 발만 쏜다', (count) => {
    const f = shooting();
    f.state.enemies = Array.from({ length: count }, (_, index) =>
      lineEnemy(10 + index, index + 1, (index % 3) - 1),
    );
    const events: SimEvent[] = [];
    attackEnemies(f.db, f.battle.stage, f.state, events);
    const shots = events.filter((event) => event.type === 'attack');
    const hits = events.filter((event) => event.type === 'damage');
    expect(shots).toHaveLength(Math.min(count, 3));
    expect(hits).toHaveLength(shots.length);
    expect(new Set(shots.map((event) => event.dst.uid)).size).toBe(shots.length);
    expect(hits.every((event) => event.amount === 535)).toBe(true);
    for (const enemy of f.state.enemies)
      expect(enemy.hp).toBe(shots.some((event) => event.dst.uid === enemy.uid) ? 9465 : 10000);
    expect(f.unit.skillHitCount).toBe(count > 0 ? 1 : 0);
    expect(f.unit.atkCooldown).toBe(count > 0 ? 72 : 0);
  });

  it('같은 줄의 세 명도 모두 공격하고 남은 거리·uid로 우선순위를 정한다', () => {
    const f = shooting();
    f.state.enemies = [lineEnemy(13, 4), lineEnemy(12, 4), lineEnemy(11, 4), lineEnemy(10, 1)];
    expect(pickEnemies(f.db, f.battle.stage, f.state, f.unit, 3).map((enemy) => enemy.uid)).toEqual([
      11, 12, 13,
    ]);
    const events: SimEvent[] = [];
    attackEnemies(f.db, f.battle.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack').map((event) => event.dst.uid)).toEqual([
      11, 12, 13,
    ]);
    expect(f.state.enemies.find((enemy) => enemy.uid === 10)?.hp).toBe(10000);
  });

  it('죽은 적·범위 밖은 제외하고 대공 설정을 모든 대상에게 적용한다', () => {
    const f = shooting();
    const air = { ...lineEnemy(12, 3, -1), enemyId: 'crow', routeId: 'air' };
    f.state.enemies = [
      { ...lineEnemy(10, 5), hp: 0 },
      lineEnemy(11, 6),
      air,
      lineEnemy(13, 2, 2),
      lineEnemy(14, 1),
    ];
    expect(pickEnemies(f.db, f.battle.stage, f.state, f.unit, 3).map((enemy) => enemy.uid)).toEqual([12, 14]);
    const groundOnly = { ...f.db, units: new Map([...f.db.units, ['wolf', { ...f.def, canHitAir: false }]]) };
    expect(pickEnemies(groundOnly, f.battle.stage, f.state, f.unit, 3).map((enemy) => enemy.uid)).toEqual([
      14,
    ]);
  });

  it('스킬 중에도 2.4초마다 한 번의 동시 사격을 하고 빈 줄에 발사하지 않는다', () => {
    const f = shooting();
    f.state.enemies = [lineEnemy(10, 3, -1), lineEnemy(11, 3), lineEnemy(12, 3, 1)];
    const volleys: { tick: number; shots: number }[] = [];
    for (let tick = 0; tick <= 144; tick++) {
      const events: SimEvent[] = [];
      attackEnemies(f.db, f.battle.stage, f.state, events);
      const shots = events.filter((event) => event.type === 'attack').length;
      if (shots) volleys.push({ tick, shots });
    }
    expect(volleys).toEqual([
      { tick: 0, shots: 3 },
      { tick: 72, shots: 3 },
      { tick: 144, shots: 3 },
    ]);
    expect(f.unit.skillHitCount).toBe(3);
  });

  it('한 발로 처치한 적에게 남은 발을 중복하지 않는다', () => {
    const f = shooting();
    f.state.enemies = [{ ...lineEnemy(10, 3), hp: 100 }];
    const events: SimEvent[] = [];
    attackEnemies(f.db, f.battle.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(1);
  });

  it('12초 경계에서 공격력·범위·대상 수를 기본으로 복원한다', () => {
    const f = lineBattle();
    activateLine(f);
    expect(unitStats(f.db, f.battle.stage, f.battle.state, f.unit)).toEqual({
      atk: 585,
      atkIntervalTicks: 72,
    });
    run(f.battle, secToTicks(f.skill.durationSec) - 1);
    expect(f.unit.skillState).toBe('active');
    expect(run(f.battle, 2)).toContainEqual({ type: 'skillEnd', uid: f.unit.uid });
    expect(f.unit.buffs).toEqual([]);
    expect(f.battle.rangeTilesFor('wolf', LINE_TILE, 'right')).toHaveLength(5);
    expect(unitStats(f.db, f.battle.stage, f.battle.state, f.unit)).toEqual({
      atk: 650,
      atkIntervalTicks: 72,
    });
    const active = shooting();
    active.state.tick = active.unit.skillEndTick;
    updateSkillTimers(active.db, active.battle.stage, active.state, []);
    active.state.enemies = [lineEnemy(10, 3), lineEnemy(11, 4), lineEnemy(12, 3, 1)];
    const events: SimEvent[] = [];
    attackEnemies(active.db, active.battle.stage, active.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
    expect(events.find((event) => event.type === 'damage')?.amount).toBe(600);
  });

  it('스킬 중 후퇴·재배치하면 단일 사격과 시작 SP로 돌아온다', () => {
    const f = lineBattle();
    activateLine(f);
    f.battle.enqueue({ type: 'retreat', uid: f.unit.uid });
    f.battle.flush();
    run(f.battle, secToTicks(f.def.redeploySec));
    f.battle.enqueue({ type: 'deploy', unitId: 'wolf', tile: LINE_TILE, dir: 'left' });
    f.battle.flush();
    const replacement = f.battle.unitAt(LINE_TILE);
    expect(replacement).toMatchObject({
      sp: f.skill.spStart,
      buffs: [],
      skillState: 'charging',
      atkCooldown: 0,
    });
    expect(replacement?.uid).toBeGreaterThan(f.unit.uid);
    expect(f.battle.rangeTilesFor('wolf', LINE_TILE, 'left')).toHaveLength(5);
  });

  it('대상 입력 순서가 달라도 동시 사격 이벤트와 상태 해시가 같다', () => {
    const execute = (reverse: boolean) => {
      const f = shooting();
      const enemies = [lineEnemy(10, 2), lineEnemy(11, 2), lineEnemy(12, 3, 1), lineEnemy(13, 4)];
      f.state.enemies = reverse ? [...enemies].reverse() : enemies;
      const events: SimEvent[] = [];
      attackEnemies(f.db, f.battle.stage, f.state, events);
      f.state.enemies.sort((a, b) => a.uid - b.uid);
      return { events, hash: hashState(f.state) };
    };
    expect(execute(false)).toEqual(execute(true));
  });
});
