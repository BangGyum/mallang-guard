import { Box3, PerspectiveCamera, Vector3 } from 'three';

export interface SafeRect {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

export const BOARD_SAFE_RECT: SafeRect = { left: -0.94, right: 0.94, bottom: -0.62, top: 0.86 };

export function fitCamera(
  boardBox: Box3,
  aspect: number,
  safeRect: SafeRect = BOARD_SAFE_RECT,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(30, aspect, 0.1, 100);
  const center = boardBox.getCenter(new Vector3());
  const pitch = (55 * Math.PI) / 180;
  const backward = new Vector3(0, Math.sin(pitch), Math.cos(pitch));
  const up = new Vector3(0, Math.cos(pitch), -Math.sin(pitch));
  const corners: Vector3[] = [];
  for (const x of [boardBox.min.x, boardBox.max.x]) {
    for (const y of [boardBox.min.y, boardBox.max.y]) {
      for (const z of [boardBox.min.z, boardBox.max.z]) corners.push(new Vector3(x, y, z));
    }
  }

  function place(distance: number): void {
    camera.position.copy(center).addScaledVector(backward, distance);
    camera.lookAt(center);
    camera.updateMatrixWorld();
  }

  function projectedBounds(): Box3 {
    const bounds = new Box3();
    const projected = new Vector3();
    for (const corner of corners) bounds.expandByPoint(projected.copy(corner).project(camera));
    return bounds;
  }

  let min = 4;
  let max = 80;
  for (let iteration = 0; iteration < 24; iteration++) {
    const distance = (min + max) / 2;
    place(distance);
    const bounds = projectedBounds();
    if (
      bounds.min.x >= safeRect.left &&
      bounds.max.x <= safeRect.right &&
      bounds.min.y >= safeRect.bottom &&
      bounds.max.y <= safeRect.top
    ) {
      max = distance;
    } else {
      min = distance;
    }
  }
  place(max);

  const scale = max * Math.tan((15 * Math.PI) / 180);
  for (let iteration = 0; iteration < 2; iteration++) {
    const projectedCenter = projectedBounds().getCenter(new Vector3());
    camera.position.x += (projectedCenter.x - (safeRect.left + safeRect.right) / 2) * scale * aspect;
    camera.position.addScaledVector(up, (projectedCenter.y - (safeRect.bottom + safeRect.top) / 2) * scale);
    camera.updateMatrixWorld();
  }
  return camera;
}
