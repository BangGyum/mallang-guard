import { describe, expect, it } from 'vitest';
import { rangeTiles } from '../../src/core/grid';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import type { Polyline } from '../../src/sim/path';

function routeTiles(route: Polyline): Set<string> {
  const tiles = new Set<string>();
  for (let distance = 0; distance <= route.length; distance += 0.25) {
    const point = route.positionAt(distance);
    tiles.add(`${Math.floor(point.x)},${Math.floor(point.y)}`);
  }
  const end = route.positionAt(route.length);
  tiles.add(`${Math.floor(end.x)},${Math.floor(end.y)}`);
  return tiles;
}

describe('큰 정원의 배치 구성', () => {
  const battle = createBattle(content, 'stage-7');
  const { board, routes } = battle.stage;
  const upper = routes.get('ground');
  const lower = routes.get('lower');
  const mid = content.ranges.get('mid');
  if (!upper || !lower || !mid) throw new Error('실제 경로·사거리 없음');
  const upperTiles = routeTiles(upper);
  const lowerTiles = routeTiles(lower);
  const path = new Set(
    [...routes]
      .filter(([id]) => !battle.stage.definition.routes[id]?.flying)
      .flatMap(([, route]) => [...routeTiles(route)]),
  );

  it('위·아래 경로가 후방 골 근처에서만 합류한다', () => {
    const shared = [...upperTiles].filter((tile) => lowerTiles.has(tile));
    expect(shared.length).toBeLessThanOrEqual(3);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((tile) => Number(tile.split(',')[0]) >= board.width - 3)).toBe(true);
  });

  it('모든 고지대는 기본 중거리 사거리로 실제 경로의 적을 공격할 수 있다', () => {
    const ineffective = [];
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        if (board.kindAt(x, y) !== 'high') continue;
        const useful = (['right', 'down', 'left', 'up'] as const).some((dir) =>
          rangeTiles({ x, y }, mid.tiles, dir, board.width, board.height).some(
            (tile) => path.has(`${tile.x},${tile.y}`) && board.kindAt(tile.x, tile.y) === 'ground',
          ),
        );
        if (!useful) ineffective.push([x, y]);
      }
    expect(ineffective).toEqual([]);
  });

  it('입구와 골을 포함한 모든 지상 칸을 실제 이동 경로로 사용한다', () => {
    const unused = [];
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++)
        if (['ground', 'spawn', 'goal'].includes(board.kindAt(x, y) ?? '') && !path.has(`${x},${y}`))
          unused.push([x, y]);
    expect(unused).toEqual([]);
  });

  it('마지막 웨이브의 비행 적도 위·아래 입구에서 각각 들어온다', () => {
    const { definition } = battle.stage;
    const lastWave = Math.max(...definition.spawns.map((spawn) => spawn.wave));
    const entries = new Set(
      definition.spawns
        .filter((spawn) => spawn.wave === lastWave && content.enemies.get(spawn.enemy)?.flying)
        .map((spawn) => definition.routes[spawn.route]?.from.join(',')),
    );
    expect(entries).toEqual(
      new Set([definition.routes.ground?.from.join(','), definition.routes.lower?.from.join(',')]),
    );
  });
});
