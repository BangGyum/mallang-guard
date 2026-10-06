import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import stage from '../../src/data/stages/stage-1.json';
import { BOARD_SAFE_RECT, fitCamera } from '../../src/view/camera';

describe('fitCamera', () => {
  const width = stage.map[0]?.length ?? 0;
  const height = stage.map.length;
  const boardBox = new Box3(
    new Vector3(-width / 2, -0.9, -height / 2),
    new Vector3(width / 2, 1.2, height / 2),
  );

  it.each([
    ['16:9', 16 / 9],
    ['4:3', 4 / 3],
    ['21:9', 21 / 9],
    ['모바일 가로', 844 / 390],
  ])('%s 화면에서 보드와 캐릭터 영역이 HUD 안전 영역 안에 들어간다', (_name, aspect) => {
    const camera = fitCamera(boardBox, aspect);
    const projectedBounds = new Box3();
    for (const x of [boardBox.min.x, boardBox.max.x]) {
      for (const y of [boardBox.min.y, boardBox.max.y]) {
        for (const z of [boardBox.min.z, boardBox.max.z]) {
          const projected = new Vector3(x, y, z).project(camera);
          expect(projected.x).toBeGreaterThanOrEqual(BOARD_SAFE_RECT.left - 1e-6);
          expect(projected.x).toBeLessThanOrEqual(BOARD_SAFE_RECT.right + 1e-6);
          expect(projected.y).toBeGreaterThanOrEqual(BOARD_SAFE_RECT.bottom - 1e-6);
          expect(projected.y).toBeLessThanOrEqual(BOARD_SAFE_RECT.top + 1e-6);
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
          projectedBounds.expandByPoint(projected);
        }
      }
    }
    const center = projectedBounds.getCenter(new Vector3());
    expect(center.x).toBeCloseTo((BOARD_SAFE_RECT.left + BOARD_SAFE_RECT.right) / 2, 3);
    expect(center.y).toBeCloseTo((BOARD_SAFE_RECT.bottom + BOARD_SAFE_RECT.top) / 2, 3);
    expect(camera.fov).toBe(30);
    const direction = camera.getWorldDirection(new Vector3());
    expect(direction.x).toBeCloseTo(0);
    expect((Math.asin(-direction.y) * 180) / Math.PI).toBeCloseTo(55);
  });
});
