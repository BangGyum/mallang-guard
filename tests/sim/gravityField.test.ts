import { describe, expect, it } from 'vitest';
import type { Dir } from '../../src/core/grid';
import { attackEnemies } from '../../src/sim/systems/attack';
import { chargeSkill, startSkill } from '../../src/sim/systems/skills';
import { updateStatus } from '../../src/sim/systems/status';
import type { SimEvent } from '../../src/sim/types';
import { run } from '../helpers';
import { LINE_TILE, lineEnemy } from './lineSniperFixtures';
import { rareFixture } from './rareFixtures';

function fixture(dir: Dir = 'right') {
  const f = rareFixture('snowLeopard', false, dir);
  const events: SimEvent[] = [];
  f.state.enemies = [lineEnemy(10, 3, 0, dir)];
  chargeSkill(f.content, f.unit, f.skill.spCost, events);
  return {
    ...f,
    events,
    start() {
      startSkill(f.content, f.stage, f.state, f.unit, events);
    },
  };
}

describe('UR 노바 중력장', () => {
  it.each(['right', 'down', 'left', 'up'] satisfies Dir[])(
    '%s 방향의 사거리 안 표적 위치에 고정한다',
    (dir) => {
      const f = fixture(dir);
      f.state.enemies.push(lineEnemy(11, -2, 0, dir));
      f.start();
      expect(f.unit.gravityCenter).toEqual({ x: f.state.enemies[0]?.x, y: f.state.enemies[0]?.y });
      expect(f.unit.skillEndTick).toBe(120);
      expect(f.unit.skillState).toBe('active');
      expect(f.events.filter((e) => e.type === 'gravityField')).toHaveLength(1);
      expect(f.state.enemies[0]?.slowAmount).toBe(0.7);
      expect(f.state.enemies[1]?.slowAmount).toBe(0);
    },
  );
  it('기본 중력탄은 반경 1칸에 지상·공중 마법 피해를 준다', () => {
    const f = fixture();
    f.state.enemies = [
      lineEnemy(10, 4),
      lineEnemy(11, 3),
      lineEnemy(12, 2.9),
      { ...lineEnemy(13, 4, 1), enemyId: 'crow', routeId: 'air' },
    ];
    attackEnemies(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((e) => e.type === 'damage').map((e) => e.dst.uid)).toEqual([10, 11, 13]);
    expect(
      f.events.filter((e) => e.type === 'damage').every((e) => e.damageType === 'magic' && e.amount === 640),
    ).toBe(true);
    expect(f.unit.atkCooldown).toBe(90);
  });
  it('반경 안 일반/공중은 70%, 보스는 25%만 둔화하고 밖은 제외한다', () => {
    const f = fixture();
    f.state.enemies.push(
      { ...lineEnemy(11, 3), enemyId: 'bigJelly' },
      { ...lineEnemy(12, 3), enemyId: 'crow', routeId: 'air' },
      lineEnemy(13, 1.19),
    );
    f.start();
    expect(f.state.enemies.map((e) => e.slowAmount)).toEqual([0.7, 0.25, 0.7, 0]);
    f.state.tick = 1;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.state.enemies[0]?.slowUntilTick).toBe(2);
  });
  it('표적이 이동하거나 사망해도 중심이 따라가지 않고 새 진입 적에 적용한다', () => {
    const f = fixture();
    f.start();
    const center = { ...f.unit.gravityCenter };
    const enemy = f.state.enemies[0];
    if (!enemy) throw new Error('표적 없음');
    enemy.x += 4;
    f.state.enemies.push(lineEnemy(11, 2.5));
    f.state.tick = 1;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.unit.gravityCenter).toEqual(center);
    expect(enemy.slowAmount).toBe(0);
    expect(f.state.enemies[1]?.slowAmount).toBe(0.7);
    enemy.hp = 0;
    f.state.tick = 120;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((e) => e.type === 'damage').map((e) => e.dst.uid)).toEqual([11]);
  });
  it('4초 경계에 한 번 폭발하고 마법 저항·보호막·범위를 적용한다', () => {
    const f = fixture();
    const original = f.content.enemies.get('jelly');
    if (!original) throw new Error('적 정의 없음');
    f.content = { ...f.content, enemies: new Map(f.content.enemies).set('jelly', { ...original, res: 50 }) };
    f.state.enemies.push({ ...lineEnemy(11, 2), shield: 400 }, lineEnemy(12, 1.19));
    startSkill(f.content, f.stage, f.state, f.unit, f.events);
    f.state.tick = 119;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((e) => e.type === 'damage')).toHaveLength(0);
    f.state.tick = 120;
    updateStatus(f.content, f.stage, f.state, f.events);
    const damage = f.events.filter((e) => e.type === 'damage');
    expect(damage.map((e) => e.amount)).toEqual([960, 960]);
    expect(damage[1]?.shieldDamage).toBe(400);
    expect(f.state.enemies[1]?.hp).toBe(9440);
    expect(f.events.findIndex((e) => e.type === 'gravityField' && e.phase === 'burst')).toBeLessThan(
      f.events.findIndex((e) => e.type === 'skillEnd'),
    );
    expect(f.unit).toMatchObject({ skillState: 'charging', sp: 0, buffs: [] });
    expect(f.unit.gravityCenter).toBeUndefined();
    f.state.tick++;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.events.filter((e) => e.type === 'gravityField' && e.phase === 'burst')).toHaveLength(1);
  });
  it('시전자를 제거한 다음 틱에는 폭발 없이 둔화가 만료한다', () => {
    const f = fixture();
    f.start();
    f.state.units = [];
    f.state.tick = 120;
    updateStatus(f.content, f.stage, f.state, f.events);
    expect(f.events.some((e) => e.type === 'gravityField' && e.phase === 'burst')).toBe(false);
    expect(f.state.enemies[0]?.slowAmount).toBe(0);
  });
  it('실제 명령은 대상 없는 발동을 거부하고 후퇴·재배치 시 SP를 복원한다', () => {
    const f = rareFixture('snowLeopard');
    run(f.battle, 1200);
    f.battle.enqueue({ type: 'activateSkill', uid: f.unit.uid });
    expect(f.battle.flush()).toEqual([
      { type: 'commandRejected', cmd: { type: 'activateSkill', uid: f.unit.uid }, reason: 'noTarget' },
    ]);
    f.battle.enqueue({ type: 'retreat', uid: f.unit.uid });
    f.battle.flush();
    run(f.battle, 2100);
    f.battle.enqueue({ type: 'deploy', unitId: 'snowLeopard', tile: LINE_TILE, dir: 'right' });
    expect(f.battle.flush().some((e) => e.type === 'unitDeploy')).toBe(true);
    expect(f.battle.state.units[0]).toMatchObject({ sp: 15, skillState: 'charging', buffs: [] });
    expect(f.battle.state.units[0]?.gravityCenter).toBeUndefined();
  });
});
