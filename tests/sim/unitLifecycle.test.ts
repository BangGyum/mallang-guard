import { describe, expect, it } from 'vitest';
import { assert } from '../../src/core/assert';
import { type Dir, rotateOffset } from '../../src/core/grid';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import type { SimEvent } from '../../src/sim/types';
import { makeRawContent } from '../dataFixtures';
import { laneStage, makeContent, run } from '../helpers';

const TILE = { x: 4, y: 4 };
const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
const CASES = content.unitOrder.flatMap((unitId) => DIRECTIONS.map((dir) => ({ unitId, dir })));

function fixture(unitId: string, dir: Dir, behind = false, air = false) {
  const raw = makeRawContent();
  const [dx, dy] = rotateOffset([behind ? -1 : 1, 0], dir);
  const map = Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 9 }, (_, x) =>
      x === 0 && y === 0
        ? 'G'
        : x === TILE.x && y === TILE.y
          ? 'H'
          : x === TILE.x + dx && y === TILE.y + dy
            ? 'S'
            : '.',
    ).join(''),
  );
  const stage = laneStage(
    map,
    [
      {
        wave: 1,
        atSec: 0,
        enemy: air ? 'crow' : 'jelly',
        count: 1,
        intervalSec: 0,
        route: air ? 'air' : 'ground',
      },
    ],
    { startDp: 99 },
  );
  const db = makeContent({
    stages: [stage],
    enemies: raw.enemies.map((enemy) => ({ ...enemy, hp: 100000, speed: 0.001 })),
  });
  const def = db.units.get(unitId);
  const skill = def && db.skills.get(def.skill);
  assert(def && skill, `검사할 캐릭터 없음: ${unitId}`);
  const battle = createBattle(db, stage.id);
  battle.enqueue({ type: 'deploy', unitId, tile: TILE, dir });
  const events = battle.flush();
  const unit = battle.state.units[0];
  assert(unit, '검사 캐릭터 배치 실패');
  return { battle, def, skill, events, unit };
}

describe('아군 8종의 실제 충전·스킬·후퇴·재배치', () => {
  it.each(CASES)('$unitId / $dir 전체 생명주기', ({ unitId, dir }) => {
    const { battle, def, skill, unit, events } = fixture(unitId, dir);
    expect(battle.state.dp).toBe(99 - def.cost);
    expect(unit).toMatchObject({ unitId, tile: TILE, dir, sp: skill.spStart });
    expect(battle.checkDeploy(unitId, TILE)).toEqual({ ok: false, reason: 'notReady' });

    const attacks: number[] = [];
    let starts = 0;
    let ends = 0;
    for (let tick = 0; tick < secToTicks(100) && ends < 2; tick++) {
      if (unit.skillState === 'ready' && skill.trigger === 'manual') {
        battle.enqueue({ type: 'activateSkill', uid: unit.uid });
        events.push(...battle.flush());
      }
      const before = events.length;
      const at = battle.state.tick;
      events.push(...battle.step());
      if (events.slice(before).some((e) => e.type === 'attack')) attacks.push(at);
      starts = events.filter((e) => e.type === 'skillStart').length;
      ends = events.filter((e) => e.type === 'skillEnd').length;
      expect(Number.isFinite(unit.sp) && unit.sp >= 0 && unit.sp <= skill.spCost).toBe(true);
    }
    expect(events.filter((e) => e.type === 'commandRejected')).toEqual([]);
    expect(starts).toBe(2);
    expect(ends).toBe(2);
    expect(attacks.length).toBeGreaterThan(2);
    const [first, second] = attacks;
    assert(first !== undefined && second !== undefined, '기본 공격 2회 필요');
    expect(second - first).toBe(secToTicks(def.atkIntervalSec));
    expect(
      events.filter((e) => e.type === 'damage').every((e) => e.damageType === def.damageType && e.amount > 0),
    ).toBe(true);
    expect(unit.buffs).toEqual([]);
    expect(unit.pulsesLeft).toBe(0);
    expect(battle.state.life).toBe(3);

    const beforeRefund = battle.state.dp;
    battle.enqueue({ type: 'retreat', uid: unit.uid });
    const retreat = battle.flush();
    expect(retreat).toContainEqual({
      type: 'unitRetreat',
      uid: unit.uid,
      refund: Math.min(99 - beforeRefund, Math.floor(def.cost / 2)),
    });
    expect(battle.unitAt(TILE)).toBeUndefined();
    expect(battle.rosterView().find((card) => card.unitId === unitId)).toMatchObject({
      state: 'cooldown',
      uid: null,
      cooldownSec: def.redeploySec,
    });
    const late: SimEvent[] = run(battle, secToTicks(def.redeploySec) - 1);
    expect(
      late.some(
        (e) =>
          ((e.type === 'attack' || e.type === 'damage') && e.src?.uid === unit.uid) ||
          ('uid' in e && e.uid === unit.uid),
      ),
    ).toBe(false);
    expect(battle.checkDeploy(unitId, TILE)).toEqual({ ok: false, reason: 'notReady' });
    battle.step();
    expect(battle.checkDeploy(unitId, TILE)).toEqual({ ok: true });
    const newDir = DIRECTIONS[(DIRECTIONS.indexOf(dir) + 2) % 4];
    assert(newDir, '재배치 방향 없음');
    battle.enqueue({ type: 'deploy', unitId, tile: TILE, dir: newDir });
    expect(battle.flush().some((e) => e.type === 'unitDeploy')).toBe(true);
    const replacement = battle.unitAt(TILE);
    assert(replacement, '재배치 캐릭터 없음');
    expect(replacement.uid).toBeGreaterThan(unit.uid);
    expect(replacement).toMatchObject({
      dir: newDir,
      sp: skill.spStart,
      skillState: 'charging',
      buffs: [],
      pulsesLeft: 0,
      atkCooldown: 0,
    });
    expect(replacement).not.toHaveProperty('hp');
  });

  it.each(CASES)('$unitId / $dir 사거리 뒤의 적은 공격하지 않는다', ({ unitId, dir }) => {
    const { battle, def, skill, unit, events } = fixture(unitId, dir, true);
    events.push(...run(battle, secToTicks(25)));
    expect(events.some((e) => e.type === 'attack' || e.type === 'damage')).toBe(false);
    expect(unit.sp).toBe(skill.charge === 'attack' ? skill.spStart : skill.spCost);
    if (skill.condition === 'enemyInRange' && skill.trigger === 'manual') {
      battle.enqueue({ type: 'activateSkill', uid: unit.uid });
      expect(battle.flush()[0]).toMatchObject({ type: 'commandRejected', reason: 'noTarget' });
    }
    if (def.id === 'bunny') expect(unit.skillState).toBe('ready');
  });

  it.each(CASES)('$unitId / $dir 대공 설정에 맞게 비행 적을 공격한다', ({ unitId, dir }) => {
    const { battle, def, events } = fixture(unitId, dir, false, true);
    events.push(...run(battle, secToTicks(5)));
    expect(events.some((e) => e.type === 'attack')).toBe(def.canHitAir);
    expect(events.some((e) => e.type === 'damage')).toBe(def.canHitAir);
  });
});
