import { content } from '../src/data';
import type { RawContent } from '../src/data/types';

export function makeRawContent(): RawContent {
  return structuredClone({
    units: [...content.units.values()],
    enemies: [...content.enemies.values()],
    skills: [...content.skills.values()],
    ranges: [...content.ranges.values()],
    stages: [...content.stages.values()],
  });
}
