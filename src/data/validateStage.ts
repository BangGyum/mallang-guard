import { assert } from '../core/assert';
import type { RouteDef, SpawnGroup, StageDef } from './types';
import { bool, integer, list, number, object, point, positive, text } from './validationHelpers';

function parseSpawn(value: unknown, path: string): SpawnGroup {
  const raw = object(value, path);
  const count = integer(raw.count, `${path}.count`, 1);
  const intervalSec = number(raw.intervalSec, `${path}.intervalSec`);
  assert(count === 1 || intervalSec > 0, `${path}.intervalSec: must be positive for multiple spawns`);
  return {
    wave: integer(raw.wave, `${path}.wave`, 1),
    atSec: number(raw.atSec, `${path}.atSec`),
    enemy: text(raw.enemy, `${path}.enemy`),
    count,
    intervalSec,
    route: text(raw.route, `${path}.route`),
  };
}

function parseRoute(value: unknown, path: string, map: string[]): RouteDef {
  const raw = object(value, path);
  const route: RouteDef = { from: point(raw.from, `${path}.from`), to: point(raw.to, `${path}.to`) };
  if (raw.via !== undefined) route.via = list(raw.via, `${path}.via`, point);
  if (raw.flying !== undefined) route.flying = bool(raw.flying, `${path}.flying`);
  for (const [name, [x, y]] of [
    ...Object.entries({ from: route.from, to: route.to }),
    ...(route.via ?? []).map((tile, index) => [`via[${index}]`, tile] as const),
  ] as const) {
    assert(
      x >= 0 && x < (map[0]?.length ?? 0) && y >= 0 && y < map.length,
      `${path}.${name}: tile outside map`,
    );
  }
  if (!route.flying) {
    assert(map[route.from[1]]?.[route.from[0]] === 'S', `${path}.from: ground route must start at S`);
    assert(map[route.to[1]]?.[route.to[0]] === 'G', `${path}.to: ground route must end at G`);
  }
  return route;
}

export function parseStage(value: unknown, path: string): StageDef {
  const raw = object(value, path);
  const map = list(raw.map, `${path}.map`, text);
  assert(map.length > 0, `${path}.map: empty map`);
  const width = map[0]?.length ?? 0;
  for (const [index, row] of map.entries()) {
    assert(row.length === width, `${path}.map[${index}]: inconsistent row width`);
    assert(/^[.,H#SG]+$/.test(row), `${path}.map[${index}]: unknown tile character`);
  }
  const routes = Object.fromEntries(
    Object.entries(object(raw.routes, `${path}.routes`)).map(([id, route]) => [
      id,
      parseRoute(route, `${path}.routes.${id}`, map),
    ]),
  );
  const stage: StageDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    map,
    startDp: number(raw.startDp, `${path}.startDp`),
    life: integer(raw.life, `${path}.life`, 1),
    deployLimit: integer(raw.deployLimit, `${path}.deployLimit`, 1),
    routes,
    spawns: list(raw.spawns, `${path}.spawns`, parseSpawn),
  };
  if (raw.description !== undefined) stage.description = text(raw.description, `${path}.description`);
  if (raw.roster !== undefined) stage.roster = list(raw.roster, `${path}.roster`, text);
  if (raw.waveRepeat !== undefined) {
    const repeat = object(raw.waveRepeat, `${path}.waveRepeat`);
    const count = integer(repeat.count, `${path}.waveRepeat.count`, 1);
    const periodSec = positive(repeat.periodSec, `${path}.waveRepeat.periodSec`);
    const lastSpawn = Math.max(
      0,
      ...stage.spawns.map((group) => group.atSec + (group.count - 1) * group.intervalSec),
    );
    assert(periodSec > lastSpawn, `${path}.waveRepeat.periodSec: must exceed the last scheduled spawn`);
    const waves = Math.max(0, ...stage.spawns.map((group) => group.wave));
    const pattern = stage.spawns;
    stage.spawns = Array.from({ length: count }, (_, cycle) =>
      pattern.map((group) => ({
        ...group,
        wave: group.wave + cycle * waves,
        atSec: group.atSec + cycle * periodSec,
      })),
    ).flat();
  }
  return stage;
}
