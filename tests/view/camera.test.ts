import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { boardBox, fitCamera, SAFE_RECT } from '../../src/view/camera';

describe('camera fit', () => {
  it.each([16 / 9, 4 / 3, 21 / 9, 844 / 390, 9 / 16])(
    '비율 %f에서 모든 꼭짓점이 안전 영역 안에 있다',
    (aspect) => {
      for (const [width, height] of [
        [11, 6],
        [1, 1],
        [20, 14],
      ] as const) {
        const box = boardBox(width, height);
        const camera = fitCamera(box, aspect);
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = new Vector3(x, y, z).project(camera);
              expect(point.x).toBeGreaterThanOrEqual(SAFE_RECT.minX - 1e-6);
              expect(point.x).toBeLessThanOrEqual(SAFE_RECT.maxX + 1e-6);
              expect(point.y).toBeGreaterThanOrEqual(SAFE_RECT.minY - 1e-6);
              expect(point.y).toBeLessThanOrEqual(SAFE_RECT.maxY + 1e-6);
              expect(point.z).toBeGreaterThanOrEqual(-1);
              expect(point.z).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    },
  );
  it('같은 입력은 같은 결과를 만들고 입력 상자를 변경하지 않는다', () => {
    const box = boardBox(11, 6);
    const before = box.clone();
    const a = fitCamera(box, 16 / 9);
    const b = fitCamera(box, 16 / 9);
    expect(a.position.toArray()).toEqual(b.position.toArray());
    expect(a.quaternion.toArray()).toEqual(b.quaternion.toArray());
    expect(box.equals(before)).toBe(true);
    expect(a.fov).toBe(30);
  });
  it('사용자 지정 안전 영역에도 맞춘다', () => {
    const rect = { minX: -0.8, maxX: 0.6, minY: -0.5, maxY: 0.7 };
    const box = boardBox(11, 6);
    const camera = fitCamera(box, 4 / 3, rect);
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(point.x).toBeGreaterThanOrEqual(rect.minX);
          expect(point.x).toBeLessThanOrEqual(rect.maxX);
          expect(point.y).toBeGreaterThanOrEqual(rect.minY);
          expect(point.y).toBeLessThanOrEqual(rect.maxY);
        }
      }
    }
  });
});
