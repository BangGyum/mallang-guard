import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { parseBoard } from './board';
import { secToTicks } from './constants';
import { buildRoute } from './path';
import type { StageRuntime } from './types';

export function createStage(content: ContentDb, stageId: string): StageRuntime {
  const definition = content.stages.get(stageId);
  assert(definition, `content/stages: unknown stage "${stageId}"`);
  const board = parseBoard(definition.map);
  const routes = new Map(
    Object.entries(definition.routes).map(([id, route]) => {
      try {
        return [id, buildRoute(board, route)] as const;
      } catch (error) {
        throw new Error(
          `content/stages/${stageId}.routes.${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  const spawns = definition.spawns.map((spawn, index) => {
    const enemy = content.enemies.get(spawn.enemy);
    const route = routes.get(spawn.route);
    assert(enemy && route, `content/stages/${stageId}.spawns[${index}]: missing enemy or route`);
    return {
      enemy,
      routeId: spawn.route,
      route,
      wave: spawn.wave,
      count: spawn.count,
      atTick: secToTicks(spawn.atSec),
      intervalTicks: secToTicks(spawn.intervalSec),
    };
  });
  return { definition, board, routes, spawns };
}
