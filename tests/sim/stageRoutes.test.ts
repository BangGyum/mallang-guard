import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { isWalkable } from '../../src/sim/board';
import { TICK_RATE } from '../../src/sim/constants';
import type { SimEvent } from '../../src/sim/types';

describe('실제 스테이지의 전체 경로와 웨이브', () => {
  it.each([...content.stages.values()])(
    '$id의 모든 적이 지형을 지켜 이동하고 마지막 웨이브까지 도착한다',
    (stage) => {
      const damage = stage.spawns.reduce(
        (sum, group) => sum + group.count * (content.enemies.get(group.enemy)?.lifeDamage ?? 0),
        0,
      );
      // 조기 패배 때문에 뒤 웨이브가 생략되지 않도록 검증용 목숨만 늘립니다.
      const stages = new Map(content.stages);
      stages.set(stage.id, { ...stage, life: damage + 1 });
      const battle = createBattle({ ...content, stages }, stage.id);
      const { board } = battle.stage;
      for (let y = 0; y < board.height; y++)
        for (let x = 0; x < board.width; x++)
          expect(battle.checkDeploy('squirrel', { x, y })).toEqual(
            board.kindAt(x, y) === 'high' ? { ok: true } : { ok: false, reason: 'badTile' },
          );
      const events: SimEvent[] = [];
      const invalid = new Set<string>();
      while (battle.state.phase === 'running' && battle.state.tick < 300 * TICK_RATE) {
        events.push(...battle.step());
        for (const enemy of battle.state.enemies) {
          const x = Math.floor(enemy.x);
          const y = Math.floor(enemy.y);
          const route = battle.stage.routes.get(enemy.routeId);
          if (
            !Number.isFinite(enemy.x + enemy.y + enemy.dist) ||
            x < 0 ||
            x >= board.width ||
            y < 0 ||
            y >= board.height ||
            !route ||
            enemy.dist < 0 ||
            enemy.dist > route.length ||
            (!content.enemies.get(enemy.enemyId)?.flying && !isWalkable(board.kindAt(x, y)))
          )
            invalid.add(`${enemy.enemyId}/${enemy.routeId}@${x},${y}`);
        }
      }
      const expected = stage.spawns.reduce((sum, group) => sum + group.count, 0);
      expect([...invalid]).toEqual([]);
      expect(battle.state).toMatchObject({
        phase: 'won',
        life: 1,
        enemies: [],
        killed: 0,
        leaked: expected,
        totalEnemies: expected,
        currentWave: Math.max(...stage.spawns.map((group) => group.wave)),
      });
      const spawns = events.filter((event) => event.type === 'enemySpawn');
      expect(spawns).toHaveLength(expected);
      expect(new Set(spawns.map((event) => event.uid)).size).toBe(expected);
      expect(events.filter((event) => event.type === 'enemyLeak')).toHaveLength(expected);
      expect(events.filter((event) => event.type === 'enemyDie')).toEqual([]);
      expect(events.filter((event) => event.type === 'battleEnd')).toEqual([
        { type: 'battleEnd', result: 'won' },
      ]);
      for (const id of new Set(stage.spawns.map((group) => group.enemy)))
        expect(spawns.filter((event) => event.enemyId === id)).toHaveLength(
          stage.spawns.filter((group) => group.enemy === id).reduce((sum, group) => sum + group.count, 0),
        );
      for (const [id, route] of battle.stage.routes) {
        const target = stage.routes[id]?.to;
        expect(target).toBeDefined();
        const end = route.positionAt(route.length);
        expect([Math.floor(end.x), Math.floor(end.y)]).toEqual(target);
        expect(board.kindAt(Math.floor(end.x), Math.floor(end.y))).toBe('goal');
      }
    },
  );
});
