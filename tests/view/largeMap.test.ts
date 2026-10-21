import { Raycaster, Vector2, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { parseBoard } from '../../src/sim/board';
import { boardBox, fitCamera, SAFE_RECT } from '../../src/view/camera';
import { rayPlaneTile } from '../../src/view/picking';

describe('두 배 크기 정원', () => {
  const stage = content.stages.get('stage-7');
  const original = content.stages.get('stage-1');
  if (!stage || !original) throw new Error('실제 스테이지 없음');
  const board = parseBoard(stage.map);

  it('기존 맵의 가로·세로 타일 수를 각각 두 배로 확장한다', () => {
    expect(board.width).toBe((original.map[0]?.length ?? 0) * 2);
    expect(board.height).toBe(original.map.length * 2);
    expect([board.width, board.height]).toEqual([22, 12]);
  });

  it.each([
    [1920, 1080],
    [844, 390],
    [740, 360],
    [390, 844],
  ])('%i×%i에서 전체 맵을 맞추고 모든 고지대의 선택 좌표를 복원한다', (width, height) => {
    const rect = height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : SAFE_RECT;
    const box = boardBox(board.width, board.height);
    const camera = fitCamera(box, width / height, rect);
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(point.x).toBeGreaterThanOrEqual(rect.minX);
          expect(point.x).toBeLessThanOrEqual(rect.maxX);
          expect(point.y).toBeGreaterThanOrEqual(rect.minY);
          expect(point.y).toBeLessThanOrEqual(rect.maxY);
          expect(point.z).toBeGreaterThanOrEqual(-1);
          expect(point.z).toBeLessThanOrEqual(1);
        }
    const ray = new Raycaster();
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        if (board.kindAt(x, y) !== 'high') continue;
        const point = new Vector3(x + 0.5 - board.width / 2, 0.5, y + 0.5 - board.height / 2).project(camera);
        ray.setFromCamera(new Vector2(point.x, point.y), camera);
        expect(rayPlaneTile(ray.ray.origin, ray.ray.direction, 0.5, board.width, board.height)).toEqual({
          x,
          y,
        });
      }
  });
});
