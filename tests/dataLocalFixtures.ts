import { content } from '../src/data';
import type { RawContent, RouteDef, StageDef } from '../src/data/types';

export function fixture(): RawContent {
  return structuredClone({
    units: [...content.units.values()],
    enemies: [...content.enemies.values()],
    skills: [...content.skills.values()],
    ranges: [...content.ranges.values()],
    stages: [...content.stages.values()],
  });
}

export function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('missing fixture item');
  return item;
}

export function ground(stage: StageDef): RouteDef {
  const route = stage.routes.ground;
  if (!route) throw new Error('missing ground route');
  return route;
}
