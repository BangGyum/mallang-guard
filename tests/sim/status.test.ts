import { describe, expect, it } from 'vitest';
import { slowEnemy, stunEnemy } from '../../src/sim/systems/damage';
import { moveEnemies } from '../../src/sim/systems/movement';
import { updateSkills } from '../../src/sim/systems/skills';
import { updateStatus } from '../../src/sim/systems/status';
import { skillFixture } from './skillFixtures';

describe('상태이상·스킬 시간', () => {
  it('강한 둔화 우선·같은 세기의 시간 연장·80% 상한·만료를 지킨다', () => {
    const f = skillFixture('snail');
    slowEnemy(f.enemy, 0.4, 30, 0, f.events);
    slowEnemy(f.enemy, 0.2, 60, 0, f.events);
    expect(f.enemy).toMatchObject({ slowAmount: 0.4, slowUntilTick: 30 });
    slowEnemy(f.enemy, 0.4, 60, 0, f.events);
    expect(f.enemy.slowUntilTick).toBe(60);
    slowEnemy(f.enemy, 1, 20, 0, f.events);
    expect(f.enemy).toMatchObject({ slowAmount: 0.8, slowUntilTick: 20 });
    f.state.tick = 20;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.enemy.slowAmount).toBe(0);
    expect(f.events.filter((e) => e.type === 'status')).toEqual([
      { type: 'status', enemy: f.enemy.uid, kind: 'slow', on: true },
      { type: 'status', enemy: f.enemy.uid, kind: 'slow', on: false },
    ]);
  });
  it('기절은 더 늦은 만료 시각을 택하고 만료 틱부터 이동한다', () => {
    const f = skillFixture('bear');
    stunEnemy(f.enemy, 4, 0, f.events);
    stunEnemy(f.enemy, 2, 0, f.events);
    const distance = f.enemy.dist;
    moveEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.dist).toBe(distance);
    f.state.tick = 4;
    updateStatus(f.content, f.stage, f.state, f.events);
    moveEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.dist).toBeCloseTo(distance + 0.03);
    expect(f.events.filter((e) => e.type === 'status')).toHaveLength(2);
  });
  it('지속 스킬이 정확히 만료된 뒤 다음 틱부터 재충전된다', () => {
    const f = skillFixture('bear');
    f.activate();
    for (let tick = 0; tick < 300; tick++) {
      f.state.tick = tick;
      updateStatus(f.content, f.stage, f.state, f.events);
      updateSkills(f.content, f.stage, f.state, f.events);
      expect(f.unit.skillState).toBe('active');
      expect(f.unit.sp).toBe(15);
    }
    f.state.tick = 300;
    updateStatus(f.content, f.stage, f.state, f.events);
    updateSkills(f.content, f.stage, f.state, f.events);
    expect(f.unit).toMatchObject({ skillState: 'charging', sp: 0 });
    f.state.tick++;
    updateSkills(f.content, f.stage, f.state, f.events);
    expect(f.unit.sp).toBeCloseTo(1 / 30);
    expect(f.events.filter((e) => e.type === 'skillEnd')).toHaveLength(1);
  });
});
