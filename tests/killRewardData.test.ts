import { describe, expect, it } from 'vitest';
import { content, rawContent } from '../src/data';
import { validateContent } from '../src/data/validate';
import { createBattle } from '../src/sim/battle';
import { damageEnemy } from '../src/sim/systems/damage';
import { removeDead } from '../src/sim/systems/death';
import type { SimEvent } from '../src/sim/types';
import { makeRawContent } from './dataFixtures';
import { combatFixture, placeEnemy } from './sim/combatFixtures';

describe('처치 보상 데이터', () => {
  it('실제 적 모두에 양의 정수 보상이 있고 초기 배치 예산을 보존한다', () => {
    for (const enemy of content.enemies.values()) {
      expect(Number.isInteger(enemy.bounty)).toBe(true);
      expect(enemy.bounty).toBeGreaterThan(0);
    }
    expect([...content.stages.values()].map((stage) => stage.startDp)).toEqual([10, 18, 16, 24, 22, 25, 25]);
    expect(rawContent.stages.some((stage) => 'dpPerSec' in stage)).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '5'])('잘못된 적 보상 %s을 거부한다', (bounty) => {
    const raw = makeRawContent();
    const invalid = { ...raw, enemies: [{ ...raw.enemies[0], bounty }, ...raw.enemies.slice(1)] };
    expect(() => validateContent(invalid)).toThrow('content/enemies[0].bounty');
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('잘못된 강화 보상 %s을 거부한다', (value) => {
    const raw = makeRawContent();
    const invalid = {
      ...raw,
      skills: [{ ...raw.skills[0], effects: [{ type: 'killBounty', value }] }, ...raw.skills.slice(1)],
    };
    expect(() => validateContent(invalid)).toThrow('content/skills[0].effects[0].value');
  });
});

describe('여러 입구와 중간보스', () => {
  it.each(
    [...content.stages.values()].map((stage, index) => ({ stage, entrances: [1, 2, 2, 2, 3, 3, 3][index] })),
  )('$stage.id의 출현 지점 $entrances곳을 모두 실제 웨이브에서 사용한다', ({ stage, entrances }) => {
    const portals = new Set<string>();
    stage.map.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === 'S') portals.add(`${x},${y}`);
      });
    });
    const used = new Set(stage.spawns.map((spawn) => stage.routes[spawn.route]?.from.join(',')));
    expect(portals.size).toBe(entrances);
    expect(used).toEqual(portals);
    expect(() => createBattle(content, stage.id)).not.toThrow();
  });

  it('중간보스는 1~2 정원에 없고 3~7 정원에 주기마다 한 번 등장한다', () => {
    for (const [index, stage] of [...content.stages.values()].entries()) {
      const captains = stage.spawns.filter((spawn) => spawn.enemy === 'captainJelly');
      expect(captains.reduce((sum, spawn) => sum + spawn.count, 0)).toBe(index < 2 ? 0 : 10);
      if (index < 5) continue;
      const captain = captains[0];
      const king = stage.spawns.find((spawn) => spawn.enemy === 'kingJelly');
      expect(captain?.atSec).toBeLessThan(king?.atSec ?? 0);
      expect(captain?.wave).toBeLessThan(king?.wave ?? 0);
    }
  });

  it('첫 중간보스가 나오기 전에 추가 입구의 일반 적으로 보상을 모을 수 있다', () => {
    const garden = content.stages.get('stage-7');
    if (!garden) throw new Error('stage-7');
    expect(garden.spawns.find((spawn) => spawn.route === 'middle')?.atSec).toBe(44);
    expect(garden.spawns.find((spawn) => spawn.enemy === 'captainJelly')?.atSec).toBe(55);
  });

  it('보호막만 깨면 지급하지 않고 중간보스를 처치해야 12개를 지급한다', () => {
    const captain = content.enemies.get('captainJelly');
    const king = content.enemies.get('kingJelly');
    if (!captain || !king) throw new Error('bosses');
    expect(captain.hp).toBeLessThan(king.hp);
    expect(captain.lifeDamage).toBe(2);
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const enemy = placeEnemy(f, 1, { enemyId: captain.id, hp: captain.hp, shield: captain.shieldHp ?? 0 });
    f.state.enemies = [enemy];
    const events: SimEvent[] = [];
    damageEnemy(f.content, unit, enemy, 740, 'physical', events);
    removeDead(f.content, f.stage, f.state, events);
    expect(enemy).toMatchObject({ hp: 5000, shield: 0 });
    expect(f.state.dp).toBe(10);
    damageEnemy(f.content, unit, enemy, 5140, 'physical', events);
    removeDead(f.content, f.stage, f.state, events);
    expect(f.state).toMatchObject({ dp: 22, killed: 1 });
    expect(events.filter((event) => event.type === 'dpGain')).toEqual([
      { type: 'dpGain', amount: 12, source: 'kill', uid: enemy.uid },
    ]);
  });
});
