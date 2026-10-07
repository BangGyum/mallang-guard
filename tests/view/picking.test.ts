import { Raycaster, Vector2, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { boardBox, fitCamera } from '../../src/view/camera';
import { rayPlaneTile } from '../../src/view/picking';

describe('광선과 타일 피킹', () => {
  it('수평면의 중심·음수 월드 좌표·고지대 교차를 계산한다', () => {
    expect(rayPlaneTile({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, 0, 11, 6)).toEqual({ x: 5, y: 3 });
    expect(rayPlaneTile({ x: -4, y: 2, z: -2 }, { x: 0, y: -1, z: 0 }, 0.5, 11, 6)).toEqual({ x: 1, y: 1 });
  });
  it('보드 밖·평행·뒤쪽 교차는 null이다', () => {
    expect(rayPlaneTile({ x: 6, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }, 0, 11, 6)).toBeNull();
    expect(rayPlaneTile({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 0, 11, 6)).toBeNull();
    expect(rayPlaneTile({ x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, 0, 11, 6)).toBeNull();
  });
  it.each([16 / 9, 4 / 3, 21 / 9, 844 / 390])(
    '비율 %f에서 실제 카메라로 투영한 타일을 복원한다',
    (aspect) => {
      const camera = fitCamera(boardBox(11, 6), aspect);
      for (const [x, y, height] of [
        [2, 1, 0],
        [5, 2, 0.5],
        [10, 3, 0],
      ]) {
        if (x === undefined || y === undefined || height === undefined) throw new Error('fixture');
        const point = new Vector3(x + 0.5 - 5.5, height, y + 0.5 - 3).project(camera);
        const ray = new Raycaster();
        ray.setFromCamera(new Vector2(point.x, point.y), camera);
        expect(rayPlaneTile(ray.ray.origin, ray.ray.direction, height, 11, 6)).toEqual({ x, y });
      }
    },
  );
});
