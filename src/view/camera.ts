import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { assert } from '../core/assert';

export interface SafeRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export const SAFE_RECT: SafeRect = { minX: -0.94, maxX: 0.94, minY: -0.62, maxY: 0.86 };

export function boardBox(width: number, height: number): Box3 {
  return new Box3(new Vector3(-width / 2, -0.9, -height / 2), new Vector3(width / 2, 1.2, height / 2));
}

export function fitCamera(box: Box3, aspect: number, safeRect: SafeRect = SAFE_RECT): PerspectiveCamera {
  assert(aspect > 0, 'camera.aspect: must be positive');
  const camera = new PerspectiveCamera(30, aspect, 0.1, 200);
  const center = box.getCenter(new Vector3());
  const pitch = (55 * Math.PI) / 180;
  const direction = new Vector3(0, Math.sin(pitch), Math.cos(pitch));
  const up = new Vector3(0, Math.cos(pitch), -Math.sin(pitch));
  const corners = [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))),
  );
  const targetX = (safeRect.minX + safeRect.maxX) / 2;
  const targetY = (safeRect.minY + safeRect.maxY) / 2;
  const halfFov = Math.tan((camera.fov * Math.PI) / 360);

  function place(distance: number): boolean {
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    // 평행 이동 뒤의 원근 투영까지 탐색에 포함해 화면 가장자리 잘림을 막는다.
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const projected = corners.map((corner) => corner.clone().project(camera));
      const minX = Math.min(...projected.map((point) => point.x));
      const maxX = Math.max(...projected.map((point) => point.x));
      const minY = Math.min(...projected.map((point) => point.y));
      const maxY = Math.max(...projected.map((point) => point.y));
      camera.position.x += ((minX + maxX) / 2 - targetX) * distance * halfFov * aspect;
      camera.position.addScaledVector(up, ((minY + maxY) / 2 - targetY) * distance * halfFov);
      camera.updateMatrixWorld();
    }
    return corners.every((corner) => {
      const point = corner.clone().project(camera);
      return (
        point.x >= safeRect.minX &&
        point.x <= safeRect.maxX &&
        point.y >= safeRect.minY &&
        point.y <= safeRect.maxY &&
        point.z >= -1 &&
        point.z <= 1
      );
    });
  }

  let low = 4;
  let high = 160;
  assert(place(high), 'camera.boardBox: cannot fit within maximum distance');
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) / 2;
    if (place(middle)) high = middle;
    else low = middle;
  }
  place(high);
  return camera;
}
