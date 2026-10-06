import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { type Board, parseBoard } from '../../src/sim/board';
import { buildRoute, createPolyline, findTilePath } from '../../src/sim/path';

const stage = content.stages.get('stage-1');
if (!stage) throw new Error('stage-1 fixture missing');
const board = parseBoard(stage.map);
const groundDef = stage.routes.ground;
const airDef = stage.routes.air;
if (!groundDef || !airDef) throw new Error('route fixture missing');
const ground = buildRoute(board, groundDef);

function corners(map: Board, route: Parameters<typeof buildRoute>[1]): number[][] {
  return buildRoute(map, route).points.map(({ x, y }) => [x - 0.5, y - 0.5]);
}

describe('stage-1 routes', () => {
  it('지상 경로의 꺾이는 점과 길이가 명세와 일치한다', () => {
    expect(corners(board, groundDef)).toEqual([
      [0, 1],
      [4, 1],
      [4, 3],
      [6, 3],
      [6, 1],
      [9, 1],
      [9, 3],
      [10, 3],
    ]);
    expect(ground.length).toBe(16);
    expect(ground.cumulativeLengths).toEqual([0, 4, 6, 8, 10, 13, 15, 16]);
  });
  it('비행 경로는 지형을 무시한 직선 한 구간이다', () => {
    const air = buildRoute(board, airDef);
    expect(air.points).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 10.5, y: 3.5 },
    ]);
    expect(air.length).toBeCloseTo(Math.sqrt(104), 12);
    const half = air.positionAt(air.length / 2);
    expect(half.x).toBeCloseTo(5.5, 12);
    expect(half.y).toBeCloseTo(2.5, 12);
    expect(half.segIndex).toBe(0);
  });
  it.each([
    [0, 0.5, 1.5, 0],
    [2, 2.5, 1.5, 0],
    [4, 4.5, 1.5, 1],
    [5, 4.5, 2.5, 1],
    [6, 4.5, 3.5, 2],
    [8, 6.5, 3.5, 3],
    [10, 6.5, 1.5, 4],
    [13, 9.5, 1.5, 5],
    [15, 9.5, 3.5, 6],
    [16, 10.5, 3.5, 6],
  ])('거리 %f의 위치와 구간이 정확하다', (distance, x, y, segIndex) => {
    for (const hint of [-100, 0, 3, 6, 100])
      expect(ground.positionAt(distance, hint)).toEqual({ x, y, segIndex });
  });
  it('경로 양끝을 넘는 거리는 양끝으로 제한한다', () => {
    expect(ground.positionAt(-10)).toEqual(ground.positionAt(0));
    expect(ground.positionAt(Infinity)).toEqual(ground.positionAt(ground.length));
  });
  it('밀치기로 거리가 감소해도 앞 구간을 다시 찾는다', () => {
    const forward = ground.positionAt(14);
    expect(forward.segIndex).toBe(5);
    expect(ground.positionAt(2, forward.segIndex)).toEqual({ x: 2.5, y: 1.5, segIndex: 0 });
  });
});

describe('ground A*', () => {
  it('같은 f에서 h가 낮은 노드, 같은 h에서는 먼저 열린 노드를 고른다', () => {
    const map = parseBoard(['S..', '...', '..G']);
    const route = { from: [0, 0], to: [2, 2] } as const;
    const expected = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(
      findTilePath(map, { x: route.from[0], y: route.from[1] }, { x: route.to[0], y: route.to[1] }),
    ).toEqual(expected);
    for (let run = 0; run < 10; run += 1)
      expect(findTilePath(map, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual(expected);
  });
  it('우회로가 같은 비용이면 down을 up보다 먼저 연다', () => {
    expect(corners(parseBoard(['...', 'S#G', '...']), { from: [0, 1], to: [2, 1] })).toEqual([
      [0, 1],
      [0, 2],
      [2, 2],
      [2, 1],
    ]);
  });
  it.each(['H', '#'])('%s를 피하고 이동마다 상하좌우 한 칸만 움직인다', (obstacle) => {
    const map = parseBoard([`S.${obstacle}G`, '....']);
    const tiles = findTilePath(map, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(tiles.length - 1).toBe(5);
    expect(tiles.some((tile) => tile.x === 2 && tile.y === 0)).toBe(false);
    for (const [index, tile] of tiles.entries()) {
      const previous = tiles[index - 1];
      if (previous) expect(Math.abs(tile.x - previous.x) + Math.abs(tile.y - previous.y)).toBe(1);
    }
  });
  it('path 전용 칸도 이동한다', () => {
    expect(buildRoute(parseBoard(['S,,G']), { from: [0, 0], to: [3, 0] }).length).toBe(3);
  });
  it('경유점마다 경로를 연결하고 중복 경유점을 제거한다', () => {
    const map = parseBoard(['S...G', '.....']);
    const route = {
      from: [0, 0],
      via: [
        [2, 1],
        [2, 1],
      ],
      to: [4, 0],
    } satisfies Parameters<typeof buildRoute>[1];
    const path = buildRoute(map, route);
    expect(corners(map, route)).toEqual([
      [0, 0],
      [2, 0],
      [2, 1],
      [4, 1],
      [4, 0],
    ]);
    expect(path.length).toBe(6);
    expect(
      path.cumulativeLengths.every(
        (length, index) => index === 0 || length > (path.cumulativeLengths[index - 1] ?? 0),
      ),
    ).toBe(true);
  });
  it('같은 직선 위에서 되돌아가는 경유점의 거리도 보존한다', () => {
    const map = parseBoard(['S...G']);
    const route = {
      from: [0, 0],
      via: [
        [3, 0],
        [1, 0],
      ],
      to: [4, 0],
    } satisfies Parameters<typeof buildRoute>[1];
    const path = buildRoute(map, route);
    expect(corners(map, route)).toEqual([
      [0, 0],
      [3, 0],
      [1, 0],
      [4, 0],
    ]);
    expect(path.length).toBe(8);
    expect(path.positionAt(4)).toEqual({ x: 2.5, y: 0.5, segIndex: 1 });
  });
  it('연결되지 않는 지상 경로를 거부한다', () => {
    expect(() => buildRoute(parseBoard(['S#G']), { from: [0, 0], to: [2, 0] })).toThrow(
      'path: no ground route',
    );
  });
  it('이동 불가능한 경유점과 맵 밖 지점을 거부한다', () => {
    const map = parseBoard(['S.HG']);
    expect(() => buildRoute(map, { from: [0, 0], via: [[2, 0]], to: [3, 0] })).toThrow(
      'path: tile (2,0) is not walkable',
    );
    expect(() => findTilePath(map, { x: -1, y: 0 }, { x: 3, y: 0 })).toThrow('not walkable');
  });
  it('시작과 도착이 같은 칸이면 한 점을 반환한다', () => {
    expect(findTilePath(parseBoard(['S.G']), { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([{ x: 1, y: 0 }]);
  });
});

describe('polyline', () => {
  it('비행 경유점은 장애물 위에서도 지정된 순서로 연결한다', () => {
    const path = buildRoute(parseBoard(['S#H', '#..', '##G']), {
      from: [0, 0],
      via: [[2, 0]],
      to: [2, 2],
      flying: true,
    });
    expect(path.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 2.5, y: 2.5 },
    ]);
    expect(path.length).toBe(4);
    expect(path.positionAt(3)).toEqual({ x: 2.5, y: 1.5, segIndex: 1 });
  });
  it('연속 중복점을 제거해 길이 0인 구간을 만들지 않는다', () => {
    const path = createPolyline([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(path.points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(path.cumulativeLengths).toEqual([0, 1]);
    expect(path.positionAt(0.5)).toEqual({ x: 0.5, y: 0, segIndex: 0 });
  });
  it('한 점 경로는 나눗셈 없이 그 점을 반환한다', () => {
    const path = createPolyline([{ x: 2.5, y: 3.5 }]);
    expect(path.length).toBe(0);
    for (const distance of [-1, 0, 10])
      expect(path.positionAt(distance, 99)).toEqual({ x: 2.5, y: 3.5, segIndex: 0 });
  });
  it('원본 좌표를 변경해도 경로와 계산 결과가 바뀌지 않는다', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ];
    const path = createPolyline(input);
    const first = input[0];
    if (first) first.x = 100;
    input.push({ x: 5, y: 5 });
    expect(path.length).toBe(2);
    expect(path.positionAt(1)).toEqual({ x: 1, y: 0, segIndex: 0 });
  });
  it('빈 폴리라인을 거부한다', () => {
    expect(() => createPolyline([])).toThrow('path.points: empty polyline');
  });
});
