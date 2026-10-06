import type { Tile } from './grid';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function dist(a: Tile, b: Tile): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
