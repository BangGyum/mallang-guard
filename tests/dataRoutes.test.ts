import { describe, expect, it } from 'vitest';
import { content } from '../src/data';
import { validateContent } from '../src/data/validate';
import { createBattle } from '../src/sim/battle';
import { makeRawContent } from './dataFixtures';

describe('content routes', () => {
  it.each([...content.stages.values()])('$id의 모든 경로로 전투를 생성한다', (stage) => {
    const battle = createBattle(content, stage.id);
    expect(battle.state.phase).toBe('running');
    for (const [id, route] of Object.entries(stage.routes)) {
      const path = battle.stage.routes.get(id);
      if (!path) throw new Error('runtime route missing');
      expect(path.length).toBeGreaterThan(0);
      expect(path.positionAt(0)).toMatchObject({ x: route.from[0] + 0.5, y: route.from[1] + 0.5 });
      expect(path.positionAt(path.length)).toMatchObject({ x: route.to[0] + 0.5, y: route.to[1] + 0.5 });
    }
  });
  it('구조 검증을 통과해도 끊긴 지상 경로는 전투 생성에 실패한다', () => {
    const raw = makeRawContent();
    const stage = raw.stages[0];
    if (!stage) throw new Error('fixture missing');
    stage.map[1] = 'S###.H....#';
    const db = validateContent(raw);
    expect(() => createBattle(db, stage.id)).toThrow(
      'content/stages/stage-1.routes.ground: path: no ground route',
    );
  });
});
