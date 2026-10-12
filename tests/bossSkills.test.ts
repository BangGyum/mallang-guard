import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { secToTicks } from '../src/sim/constants';
import { hashState } from '../src/sim/hash';
import { updateBossSkills } from '../src/sim/systems/bossSkills';
import { removeDead } from '../src/sim/systems/death';
import { updateEnemyMotion } from '../src/sim/systems/enemyMotion';
import { moveEnemies } from '../src/sim/systems/movement';
import type { SimEvent } from '../src/sim/types';
import { enemyRosterFixture } from './sim/enemyRosterFixtures';

const ids = [
  'bigJelly',
  'gateJelly',
  'splitCaptain',
  'greenhouseKeeper',
  'stormCrow',
  'kingJelly',
  'gardenKing',
];
function fixture(id: string) {
  const f = enemyRosterFixture([id]);
  const enemy = f.state.enemies[0];
  const def = content.enemies.get(id);
  if (!enemy || !def?.bossSkill) throw new Error('보스 스킬 없음');
  const events: SimEvent[] = [];
  const step = () => updateBossSkills(f.content, f.stage, f.state, events);
  const cast = () => {
    enemy.abilityCooldown = 1;
    step();
    expect(enemy.bossCastUntilTick).toBeGreaterThan(f.state.tick);
    f.state.tick = enemy.bossCastUntilTick;
    step();
  };
  return { ...f, enemy, def, skill: def.bossSkill, events, step, cast };
}

describe('보스 전용 스킬', () => {
  it.each(ids)('%s는 최초 충전과 예고 시간을 실제 데이터대로 가진다', (id) => {
    const f = fixture(id);
    expect(f.enemy.abilityCooldown).toBe(secToTicks(f.skill.firstCastSec));
    expect(f.enemy.bossCastUntilTick).toBe(0);
    expect(f.skill.windupSec).toBeGreaterThan(0);
    expect(f.skill.description).not.toBe('');
  });
  it('7종의 이름이 모두 다르고 신규 상태도 해시에 반영한다', () => {
    expect(new Set(ids.map((id) => content.enemies.get(id)?.bossSkill?.name)).size).toBe(7);
    const f = fixture('bigJelly');
    const before = hashState(f.state);
    f.enemy.bossCastUntilTick = 1;
    expect(hashState(f.state)).not.toBe(before);
  });
  it.each(['bigJelly', 'stormCrow'])('%s는 예고 중 멈추고 완료 후 정해진 시간만 돌진한다', (id) => {
    const f = fixture(id);
    if (f.skill.effect.type !== 'rush') throw new Error('돌진 스킬 아님');
    const effect = f.skill.effect;
    f.enemy.abilityCooldown = 1;
    f.step();
    const at = f.enemy.dist;
    updateEnemyMotion(f.content, f.state);
    moveEnemies(f.content, f.stage, f.state, f.events);
    expect(f.enemy.dist).toBe(at);
    expect(f.events.filter((event) => event.type === 'bossSkill')).toHaveLength(1);
    f.state.tick = f.enemy.bossCastUntilTick - 1;
    f.step();
    expect(f.enemy.rushUntilTick).toBe(0);
    f.state.tick++;
    f.step();
    updateEnemyMotion(f.content, f.state);
    expect(f.enemy.speedMul).toBe(effect.speedMul);
    expect(f.enemy.rushUntilTick).toBe(f.state.tick + secToTicks(effect.durationSec));
    f.state.tick = f.enemy.rushUntilTick;
    updateEnemyMotion(f.content, f.state);
    expect(f.enemy.speedMul).toBe(1);
  });
  it('성문은 완전한 보호막에서 기다리며 상한을 넘겨 재충전하지 않는다', () => {
    const f = fixture('gateJelly');
    f.enemy.abilityCooldown = 1;
    f.step();
    expect(f.enemy.bossCastUntilTick).toBe(0);
    expect(f.events).toEqual([]);
    f.enemy.shield = 850;
    const hp = f.enemy.hp;
    f.cast();
    expect(f.enemy.shield).toBe(900);
    expect(f.enemy.hp).toBe(hp);
    expect(f.state.dp).toBe(90);
  });
  it('기절은 준비를 한 번 취소하고 기절 중 재충전도 멈춘다', () => {
    const f = fixture('gateJelly');
    f.enemy.shield = 100;
    f.enemy.abilityCooldown = 1;
    f.step();
    f.enemy.stunUntilTick = f.state.tick + 10;
    f.step();
    f.step();
    expect(f.enemy.bossCastUntilTick).toBe(0);
    expect(f.enemy.shield).toBe(100);
    expect(f.enemy.abilityCooldown).toBe(secToTicks(f.skill.intervalSec));
    expect(f.events.filter((event) => event.type === 'bossSkill' && event.phase === 'cancel')).toHaveLength(
      1,
    );
    expect(f.events.filter((event) => event.type === 'bossSkill' && event.phase === 'cast')).toEqual([]);
  });
  it('준비 중 죽은 보스는 소환을 발동하지 않는다', () => {
    const f = fixture('gardenKing');
    f.enemy.abilityCooldown = 1;
    f.step();
    f.enemy.hp = 0;
    f.state.tick = f.enemy.bossCastUntilTick;
    f.step();
    removeDead(f.content, f.stage, f.state, f.events);
    expect(f.state.enemies).toEqual([]);
    expect(f.events.filter((event) => event.type === 'bossSkill' && event.phase === 'cast')).toEqual([]);
  });
  it('개화는 다친 대상만 선택하고 거리·인원·최대 체력을 지킨다', () => {
    const f = enemyRosterFixture(['greenhouseKeeper', 'jelly', 'hardJelly', 'dashJelly']);
    const [boss, first, second, third] = f.state.enemies;
    if (!boss || !first || !second || !third) throw new Error('회복 대상 없음');
    for (const enemy of f.state.enemies) enemy.hp -= 70;
    third.x = 30;
    const events: SimEvent[] = [];
    boss.abilityCooldown = 1;
    updateBossSkills(f.content, f.stage, f.state, events);
    expect(first.hp).toBe(first.maxHp - 70);
    f.state.tick = boss.bossCastUntilTick;
    updateBossSkills(f.content, f.stage, f.state, events);
    expect([boss.hp, first.hp, second.hp]).toEqual([boss.maxHp, first.maxHp, second.maxHp]);
    expect(third.hp).toBe(third.maxHp - 70);
    expect(events.filter((event) => event.type === 'enemyHeal')).toHaveLength(3);
  });
  it('개화는 인원 제한보다 많은 후보를 체력 비율·uid 순으로 고른다', () => {
    const f = enemyRosterFixture(['greenhouseKeeper', 'jelly', 'hardJelly', 'dashJelly', 'crystalJelly']);
    const [boss, first, second, third, fourth] = f.state.enemies;
    if (!boss || !first || !second || !third || !fourth) throw new Error('회복 후보 없음');
    for (const [enemy, ratio] of [
      [boss, 0.9],
      [first, 0.2],
      [second, 0.2],
      [third, 0.5],
      [fourth, 0.6],
    ] as const)
      enemy.hp = enemy.maxHp * ratio;
    const before = f.state.enemies.map((enemy) => enemy.hp);
    const events: SimEvent[] = [];
    boss.abilityCooldown = 1;
    updateBossSkills(f.content, f.stage, f.state, events);
    f.state.tick = boss.bossCastUntilTick;
    updateBossSkills(f.content, f.stage, f.state, events);
    expect(events.filter((event) => event.type === 'enemyHeal').map((event) => event.uid)).toEqual([
      first.uid,
      second.uid,
      third.uid,
    ]);
    expect(boss.hp).toBe(before[0]);
    expect(fourth.hp).toBe(before[4]);
  });
  it.each(['greenhouseKeeper', 'kingJelly'])('%s는 대상이 없을 때 준비를 유지하고 예고하지 않는다', (id) => {
    const f = fixture(id);
    f.state.units = [];
    f.enemy.abilityCooldown = 1;
    f.step();
    f.state.tick++;
    f.step();
    expect(f.enemy.abilityCooldown).toBe(0);
    expect(f.enemy.bossCastUntilTick).toBe(0);
    expect(f.events).toEqual([]);
  });
  it.each([
    ['splitCaptain', 2, 1],
    ['gardenKing', 3, 2],
  ] as const)('%s의 소환 횟수·자식 수·보상 조건을 지킨다', (id, casts, count) => {
    const f = fixture(id);
    const dp = f.state.dp;
    for (let i = 0; i < casts; i++) f.cast();
    expect(f.enemy.summonsRemaining).toBe(0);
    f.enemy.abilityCooldown = 0;
    f.step();
    expect(f.enemy.bossCastUntilTick).toBe(0);
    expect(f.state.enemies.filter((enemy) => enemy.enemyId === 'miniJelly')).toHaveLength(casts * count);
    expect(new Set(f.state.enemies.map((enemy) => enemy.uid)).size).toBe(1 + casts * count);
    expect(f.state.totalEnemies).toBe(1 + casts * count);
    expect(f.state.dp).toBe(dp);
    expect(f.events.filter((event) => event.type === 'dpGain')).toEqual([]);
  });
  it('왕실 행군 지원은 보스를 기절시키면 해제한다', () => {
    const f = enemyRosterFixture(['gardenKing', 'jelly']);
    const [boss, child] = f.state.enemies;
    if (!boss || !child) throw new Error('행군 대상 없음');
    updateEnemyMotion(f.content, f.state);
    expect(child.speedMul).toBe(1.12);
    boss.stunUntilTick = f.state.tick + 1;
    updateEnemyMotion(f.content, f.state);
    expect(child.speedMul).toBe(1);
  });
});
