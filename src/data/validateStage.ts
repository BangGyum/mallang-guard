import type { RouteDef, SpawnGroup, StageDef } from './types';
import { array, boolean, fail, integer, numeric, pair, positive, record, text } from './validateValues';

function parseRoute(value: unknown, path: string, map: string[]): RouteDef {
  const raw = record(value, path);
  const route: RouteDef = {
    from: pair(raw.from, `${path}.from`),
    to: pair(raw.to, `${path}.to`),
  };
  if (raw.flying !== undefined) route.flying = boolean(raw.flying, `${path}.flying`);
  if (raw.via !== undefined) {
    route.via = array(raw.via, `${path}.via`).map((tile, index) => pair(tile, `${path}.via[${index}]`));
  }
  const points: [string, [number, number]][] = [
    [`${path}.from`, route.from],
    [`${path}.to`, route.to],
    ...(route.via ?? []).map((tile, index): [string, [number, number]] => [`${path}.via[${index}]`, tile]),
  ];
  for (const [pointPath, [x, y]] of points) {
    if (x < 0 || x >= (map[0]?.length ?? 0) || y < 0 || y >= map.length) {
      fail(pointPath, 'coordinate outside map');
    }
  }
  if (!route.flying) {
    if (map[route.from[1]]?.[route.from[0]] !== 'S') fail(`${path}.from`, 'ground route must start at S');
    if (map[route.to[1]]?.[route.to[0]] !== 'G') fail(`${path}.to`, 'ground route must end at G');
  }
  return route;
}

function parseSpawn(value: unknown, path: string): SpawnGroup {
  const raw = record(value, path);
  const spawn: SpawnGroup = {
    wave: integer(raw.wave, `${path}.wave`, 1),
    atSec: numeric(raw.atSec, `${path}.atSec`),
    enemy: text(raw.enemy, `${path}.enemy`),
    count: integer(raw.count, `${path}.count`, 1),
    intervalSec: numeric(raw.intervalSec, `${path}.intervalSec`),
    route: text(raw.route, `${path}.route`),
  };
  if (spawn.count > 1 && spawn.intervalSec === 0)
    fail(`${path}.intervalSec`, 'must be positive for count > 1');
  return spawn;
}

export function parseStage(value: unknown, path: string): StageDef {
  const raw = record(value, path);
  const map = array(raw.map, `${path}.map`).map((row, index) => text(row, `${path}.map[${index}]`));
  if (map.length === 0) fail(`${path}.map`, 'expected nonempty map');
  for (const [index, row] of map.entries()) {
    if (row.length !== map[0]?.length) fail(`${path}.map[${index}]`, 'map row length mismatch');
    if (!/^[.,H#SG]+$/.test(row)) fail(`${path}.map[${index}]`, 'unknown map tile');
  }
  const routes = Object.fromEntries(
    Object.entries(record(raw.routes, `${path}.routes`)).map(([id, route]) => [
      id,
      parseRoute(route, `${path}.routes.${id}`, map),
    ]),
  );
  const stage: StageDef = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    map,
    startDp: numeric(raw.startDp, `${path}.startDp`),
    life: integer(raw.life, `${path}.life`, 1),
    deployLimit: integer(raw.deployLimit, `${path}.deployLimit`, 1),
    routes,
    spawns: array(raw.spawns, `${path}.spawns`).map((spawn, index) =>
      parseSpawn(spawn, `${path}.spawns[${index}]`),
    ),
  };
  if (raw.dpPerSec !== undefined) stage.dpPerSec = positive(raw.dpPerSec, `${path}.dpPerSec`);
  if (raw.roster !== undefined) {
    stage.roster = array(raw.roster, `${path}.roster`).map((id, index) =>
      text(id, `${path}.roster[${index}]`),
    );
  }
  return stage;
}
