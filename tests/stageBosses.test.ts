import { describe, expect, it } from 'vitest';
import { CRITTER_IDS, critterSvg } from '../src/art/critters';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { createBattle } from '../src/sim/battle';
import { updateBossSkills } from '../src/sim/systems/bossSkills';
import { damageEnemy } from '../src/sim/systems/damage';
import { removeDead } from '../src/sim/systems/death';
import { moveEnemies } from '../src/sim/systems/movement';
import { checkOutcome } from '../src/sim/systems/outcome';
import type { BattleState, SimEvent } from '../src/sim/types';
import { makeRawContent } from './dataFixtures';
import { enemyRosterFixture } from './sim/enemyRosterFixtures';

const BOSSES = [
  'bigJelly',
  'gateJelly',
  'splitCaptain',
  'greenhouseKeeper',
  'stormCrow',
  'kingJelly',
  'gardenKing',
];

function bossBattle(stageId: string) {
  const stage = content.stages.get(stageId);
  if (!stage) throw new Error('스테이지 없음');
  const lastWave = Math.max(...stage.spawns.map((spawn) => spawn.wave));
  const spawn = stage.spawns.find(
    (group) => group.wave === lastWave && content.enemies.get(group.enemy)?.boss,
  );
  if (!spawn) throw new Error('최종 보스 없음');
  const stages = new Map(content.stages);
  stages.set(stageId, { ...stage, spawns: [{ ...spawn, atSec: 0 }] });
  const battle = createBattle({ ...content, stages }, stageId);
  battle.step();
  return { battle, state: structuredClone(battle.state) as BattleState };
}

describe('스테이지별 보스', () => {
  it.each(BOSSES.map((id, index) => ({ id, stageId: `stage-${index + 1}` })))(
    '$stageId는 마지막 웨이브에 $id를 정확히 한 마리 배치한다',
    ({ id, stageId }) => {
      const stage = content.stages.get(stageId);
      if (!stage) throw new Error('스테이지 없음');
      const lastWave = Math.max(...stage.spawns.map((group) => group.wave));
      const bosses = stage.spawns.filter(
        (group) => group.wave === lastWave && content.enemies.get(group.enemy)?.boss,
      );
      expect(bosses).toHaveLength(1);
      expect(bosses[0]).toMatchObject({ enemy: id, count: 1, intervalSec: 0 });
      const def = content.enemies.get(id);
      const route = bosses[0] && stage.routes[bosses[0].route];
      expect(def).toMatchObject({ boss: true });
      expect(route?.flying ?? false).toBe(def?.flying);
      expect(def?.lifeDamage).toBeGreaterThanOrEqual(2);
      expect(def?.bounty).toBeGreaterThan(0);
      expect(CRITTER_IDS).toContain(def?.art);
      if (!def) throw new Error('보스 없음');
      expect(critterSvg(def.art)).toContain('viewBox="0 0 100 100"');
    },
  );

  it('보스 표기가 없는 기존 적은 일반 적이며 원본 데이터는 바꾸지 않는다', () => {
    const raw = makeRawContent();
    const before = structuredClone(raw);
    const parsed = validateContent(raw);
    expect(parsed.enemies.get('jelly')?.boss).toBeUndefined();
    expect(parsed.enemies.get('captainJelly')?.boss).toBeUndefined();
    expect(
      [...parsed.enemies.values()]
        .filter((enemy) => enemy.boss)
        .map((enemy) => enemy.id)
        .sort(),
    ).toEqual([...BOSSES].sort());
    expect(raw).toEqual(before);
  });

  it.each([1, 'true', null, {}, []])('잘못된 boss 표기 %j를 거부한다', (boss) => {
    const raw = makeRawContent();
    const invalid = {
      ...raw,
      enemies: raw.enemies.map((enemy, i) => (i === 0 ? { ...enemy, boss } : enemy)),
    };
    expect(() => validateContent(invalid)).toThrow('content/enemies[0].boss');
  });

  it.each(['gateJelly', 'gardenKing'])('%s는 보호막부터 소모하고 초과 피해만 체력에서 뺀다', (id) => {
    const f = enemyRosterFixture([id]);
    const enemy = f.state.enemies[0];
    const def = content.enemies.get(id);
    if (!enemy || !def?.shieldHp) throw new Error('보호막 보스 없음');
    damageEnemy(f.content, f.unit, enemy, def.def + 100, 'physical', []);
    expect(enemy.hp).toBe(def.hp);
    expect(enemy.shield).toBe(def.shieldHp - 100);
    damageEnemy(f.content, f.unit, enemy, def.def + enemy.shield + 200, 'physical', []);
    expect(enemy.shield).toBe(0);
    expect(enemy.hp).toBe(def.hp - 200);
  });

  it('분열대장을 처치해도 자식 여섯을 처리하기 전에는 전투가 끝나지 않는다', () => {
    const { battle, state } = bossBattle('stage-3');
    const boss = state.enemies[0];
    if (!boss) throw new Error('보스 없음');
    const events: SimEvent[] = [];
    boss.hp = 0;
    removeDead(battle.content, battle.stage, state, events);
    checkOutcome(battle.stage, state, events);
    expect(state).toMatchObject({ phase: 'running', killed: 1, totalEnemies: 7 });
    expect(state.enemies).toHaveLength(6);
    expect(state.enemies.every((enemy) => enemy.enemyId === 'miniJelly' && enemy.shield === 0)).toBe(true);
    expect(new Set(state.enemies.map((enemy) => enemy.uid)).size).toBe(6);
    expect(events.filter((event) => event.type === 'dpGain')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'battleEnd')).toEqual([]);
    for (const child of state.enemies) child.hp = 0;
    removeDead(battle.content, battle.stage, state, events);
    checkOutcome(battle.stage, state, events);
    expect(state).toMatchObject({ phase: 'won', killed: 7, life: 3 });
    expect(events.filter((event) => event.type === 'dpGain')).toHaveLength(7);
    expect(events.filter((event) => event.type === 'battleEnd')).toEqual([
      { type: 'battleEnd', result: 'won' },
    ]);
  });

  it('온실지기의 개화 준비는 기절 중 멈추며 최대 체력을 넘기지 않는다', () => {
    const f = enemyRosterFixture(['greenhouseKeeper']);
    const enemy = f.state.enemies[0];
    const def = content.enemies.get('greenhouseKeeper');
    if (!enemy || !def) throw new Error('재생 보스 없음');
    enemy.hp = def.hp - 70;
    enemy.abilityCooldown = 1;
    enemy.stunUntilTick = f.state.tick + 1;
    const events: SimEvent[] = [];
    updateBossSkills(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(def.hp - 70);
    expect(enemy.abilityCooldown).toBe(1);
    f.state.tick++;
    updateBossSkills(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(def.hp - 70);
    f.state.tick = enemy.bossCastUntilTick;
    updateBossSkills(f.content, f.stage, f.state, events);
    expect(enemy.hp).toBe(def.hp);
    expect(events).toContainEqual({ type: 'enemyHeal', src: enemy.uid, uid: enemy.uid, amount: 70 });
  });

  it('정원군주는 최대 세 번에 여섯을 소환하고 처치 후에도 자식이 남으면 전투가 이어진다', () => {
    const { battle, state } = bossBattle('stage-7');
    const boss = state.enemies[0];
    if (!boss) throw new Error('보스 없음');
    const events: SimEvent[] = [];
    for (let i = 0; i < 4; i++) {
      boss.abilityCooldown = 1;
      updateBossSkills(battle.content, battle.stage, state, events);
      if (boss.bossCastUntilTick > 0) {
        state.tick = boss.bossCastUntilTick;
        updateBossSkills(battle.content, battle.stage, state, events);
      }
    }
    expect(boss.summonsRemaining).toBe(0);
    expect(state).toMatchObject({ totalEnemies: 7 });
    expect(state.enemies.filter((enemy) => enemy.enemyId === 'miniJelly')).toHaveLength(6);
    boss.hp = 0;
    removeDead(battle.content, battle.stage, state, events);
    checkOutcome(battle.stage, state, events);
    expect(state.phase).toBe('running');
    expect(state.enemies).toHaveLength(6);
    for (const child of state.enemies) child.hp = 0;
    removeDead(battle.content, battle.stage, state, events);
    checkOutcome(battle.stage, state, events);
    expect(state).toMatchObject({ phase: 'won', killed: 7, life: 3 });
  });

  it.each(BOSSES)('%s가 골에 도착하면 해당 누수 피해를 적용하고 보상을 주지 않는다', (id) => {
    const f = enemyRosterFixture([id]);
    const boss = f.state.enemies[0];
    const def = content.enemies.get(id);
    const route = boss && f.stage.routes.get(boss.routeId);
    if (!boss || !def || !route) throw new Error('보스 또는 경로 없음');
    boss.dist = route.length - 0.001;
    const events: SimEvent[] = [];
    const life = f.state.life;
    moveEnemies(f.content, f.stage, f.state, events);
    expect(f.state.life).toBe(life - def.lifeDamage);
    expect(events).toContainEqual({ type: 'enemyLeak', uid: boss.uid, lifeLeft: life - def.lifeDamage });
    expect(events.some((event) => event.type === 'dpGain')).toBe(false);
  });
});
