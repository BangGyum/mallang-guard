import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { hashState } from '../../src/sim/hash';
import { laneStage, makeContent, run } from '../helpers';

function fixture() {
  const map = Array.from({ length: 13 }, (_, y) =>
    y === 6 ? '......H......' : y === 7 ? 'G...........S' : '.............',
  );
  const stage = laneStage(
    map,
    [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    { startDp: 99 },
  );
  const enemies = [...content.enemies.values()].map((e) =>
    e.id === 'jelly' ? { ...e, hp: 1000000, speed: 0.06 } : e,
  );
  const db = makeContent({ stages: [stage], enemies });
  const battle = createBattle(db, stage.id);
  battle.enqueue({ type: 'deploy', unitId: 'snowLeopard', tile: { x: 6, y: 6 }, dir: 'right' });
  battle.flush();
  run(battle, 1200);
  const unit = battle.state.units[0];
  if (!unit) throw new Error('배치 실패');
  return { battle, unit };
}

describe('노바 실제 충전·명령 생명주기', () => {
  it('실제 40초 충전 후 발동하고 4초 만료에 폭발·초기화한다', () => {
    const { battle, unit } = fixture();
    expect(unit.skillState).toBe('ready');
    battle.enqueue({ type: 'activateSkill', uid: unit.uid });
    const started = battle.flush();
    expect(started.filter((e) => e.type === 'gravityField').map((e) => e.phase)).toEqual(['start']);
    const before = hashState(battle.state);
    for (let i = 0; i < 10; i++) expect(battle.flush()).toEqual([]);
    expect(hashState(battle.state)).toBe(before);
    const events = run(battle, 121);
    expect(events.filter((e) => e.type === 'gravityField').map((e) => e.phase)).toEqual(['burst']);
    expect(unit.skillState).toBe('charging');
    expect(unit.gravityCenter).toBeUndefined();
    expect(unit.sp).toBe(0);
  });
  it('발동 중 실제 후퇴 명령은 중력장을 취소하고 재배치 시 기본 SP로 돌아간다', () => {
    const { battle, unit } = fixture();
    battle.enqueue({ type: 'activateSkill', uid: unit.uid });
    battle.flush();
    expect(unit.gravityCenter).toBeDefined();
    const dp = battle.state.dp;
    battle.enqueue({ type: 'retreat', uid: unit.uid });
    expect(battle.flush()).toContainEqual({ type: 'unitRetreat', uid: unit.uid, refund: 0 });
    expect(battle.state.units).toHaveLength(0);
    const events = run(battle, 2100);
    expect(events.some((e) => e.type === 'gravityField')).toBe(false);
    expect(battle.state.enemies[0]?.slowAmount).toBe(0);
    expect(battle.state.dp).toBe(dp);
    battle.enqueue({ type: 'deploy', unitId: 'snowLeopard', tile: { x: 6, y: 6 }, dir: 'left' });
    battle.flush();
    expect(battle.state.units[0]).toMatchObject({ sp: 15, skillState: 'charging', buffs: [] });
    expect(battle.state.units[0]?.gravityCenter).toBeUndefined();
  });
  it('동일 입력의 중력장 사건과 전체 상태 해시가 같다', () => {
    const first = fixture(),
      second = fixture();
    for (const f of [first, second]) {
      f.battle.enqueue({ type: 'activateSkill', uid: f.unit.uid });
      f.battle.flush();
    }
    expect(hashState(first.battle.state)).toBe(hashState(second.battle.state));
    expect(run(first.battle, 121)).toEqual(run(second.battle, 121));
    expect(hashState(first.battle.state)).toBe(hashState(second.battle.state));
  });
});
