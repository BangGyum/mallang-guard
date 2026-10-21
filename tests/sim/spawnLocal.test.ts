import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { laneStage, makeContent, run } from '../helpers';

describe('스폰과 이동', () => {
  it('시작 틱과 반올림한 간격대로 같은 틱의 그룹 순서를 유지한다', () => {
    const stage = laneStage(
      ['S.........G'],
      [
        { wave: 1, atSec: 1, enemy: 'jelly', count: 2, intervalSec: 0.05, route: 'ground' },
        { wave: 3, atSec: 1, enemy: 'hardJelly', count: 1, intervalSec: 0, route: 'ground' },
      ],
    );
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    expect(battle.state.totalWaves).toBe(3);
    expect(run(battle, 30)).toEqual([]);
    expect(battle.state.currentWave).toBe(0);
    expect(battle.step()).toEqual([
      { type: 'enemySpawn', uid: 1, enemyId: 'jelly', x: 0.5, y: 0.5 },
      { type: 'enemySpawn', uid: 2, enemyId: 'hardJelly', x: 0.5, y: 0.5 },
    ]);
    expect(battle.state.currentWave).toBe(3);
    expect(battle.step()).toEqual([]);
    expect(battle.step()).toEqual([{ type: 'enemySpawn', uid: 3, enemyId: 'jelly', x: 0.5, y: 0.5 }]);
    expect(battle.state.spawnCursor).toEqual([2, 1]);
  });

  it('생성된 적은 중심 좌표에서 이동하며 이전 위치를 저장한다', () => {
    const stage = laneStage(
      ['S.........G'],
      [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    );
    const db = makeContent({ stages: [stage] });
    const speed = db.enemies.get('jelly')?.speed;
    if (!speed) throw new Error('jelly 없음');
    const battle = createBattle(db, stage.id);
    battle.step();
    const enemy = battle.state.enemies[0];
    if (!enemy) throw new Error('적 없음');
    expect(enemy.px).toBe(0.5);
    expect(enemy.py).toBe(0.5);
    expect(enemy.x).toBeCloseTo(0.5 + speed / 30);
    expect(enemy.y).toBe(0.5);
    expect(enemy.hp).toBe(enemy.maxHp);
    const x = enemy.x;
    battle.step();
    expect(enemy.px).toBe(x);
    expect(enemy.x).toBeCloseTo(x + speed / 30);
  });

  it('기절 중에는 멈추고 둔화 비율은 이동량에 적용된다', () => {
    const stage = laneStage(
      ['S.........G'],
      [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    );
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    battle.step();
    const enemy = battle.state.enemies[0];
    if (!enemy) throw new Error('적 없음');
    const initial = enemy.dist;
    enemy.stunUntilTick = battle.state.tick + 1;
    battle.step();
    expect(enemy.dist).toBe(initial);
    enemy.slowAmount = 0.5;
    enemy.slowUntilTick = battle.state.tick + 2;
    battle.step();
    expect(enemy.dist).toBeCloseTo(initial * 1.5);
  });
});
