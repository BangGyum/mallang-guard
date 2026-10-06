import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { parseBoard } from '../src/sim/board';
import { buildRoute } from '../src/sim/path';
import { makeRawContent } from './dataFixtures';

describe('content routes', () => {
  it.each([...content.stages.values()])('$id의 모든 경로를 생성한다', (stage) => {
    const board = parseBoard(stage.map);
    for (const route of Object.values(stage.routes)) {
      const path = buildRoute(board, route);
      expect(path.length).toBeGreaterThan(0);
      expect(path.positionAt(0)).toMatchObject({ x: route.from[0] + 0.5, y: route.from[1] + 0.5 });
      expect(path.positionAt(path.length)).toMatchObject({ x: route.to[0] + 0.5, y: route.to[1] + 0.5 });
    }
  });
  it('구조 검증을 통과해도 끊긴 지상 경로는 생성에 실패한다', () => {
    const raw = makeRawContent();
    const stage = raw.stages[0];
    if (!stage) throw new Error('fixture missing');
    stage.map[1] = 'S###.H....#';
    const db = validateContent(raw);
    const validated = db.stages.get(stage.id);
    const route = validated?.routes.ground;
    if (!validated || !route) throw new Error('fixture missing');
    expect(() => buildRoute(parseBoard(validated.map), route)).toThrow('path: no ground route');
  });
});
