import { type PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import type { Tile } from '../core/grid';
import type { Board } from '../sim/board';
import { tileHeight } from './coords';

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
const raycaster = new Raycaster();
const pointer = new Vector2();
const projected = new Vector3();

export function rayPlaneTile(
  origin: Point3,
  direction: Point3,
  planeY: number,
  width: number,
  height: number,
): Tile | null {
  if (Math.abs(direction.y) < 1e-10) return null;
  const t = (planeY - origin.y) / direction.y;
  if (t < 0) return null;
  const x = Math.floor(origin.x + t * direction.x + width / 2);
  const y = Math.floor(origin.z + t * direction.z + height / 2);
  return x >= 0 && x < width && y >= 0 && y < height ? { x, y } : null;
}

export function pickTile(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  board: Board,
  clientX: number,
  clientY: number,
): Tile | null {
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom)
    return null;
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
  raycaster.setFromCamera(pointer, camera);
  const high = rayPlaneTile(raycaster.ray.origin, raycaster.ray.direction, 0.5, board.width, board.height);
  if (high && board.kindAt(high.x, high.y) === 'high') return high;
  return rayPlaneTile(raycaster.ray.origin, raycaster.ray.direction, 0, board.width, board.height);
}

export function tileScreen(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  board: Board,
  tile: Tile,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  projected
    .set(
      tile.x + 0.5 - board.width / 2,
      tileHeight(board.kindAt(tile.x, tile.y) ?? 'ground'),
      tile.y + 0.5 - board.height / 2,
    )
    .project(camera);
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}
