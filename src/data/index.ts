import enemies from './enemies.json';
import ranges from './ranges.json';
import skills from './skills.json';
import stage1 from './stages/stage-1.json';
import stage2 from './stages/stage-2.json';
import stage3 from './stages/stage-3.json';
import stage4 from './stages/stage-4.json';
import stage5 from './stages/stage-5.json';
import stage6 from './stages/stage-6.json';
import stage7 from './stages/stage-7.json';
import units from './units.json';
import { validateContent } from './validate';

export const rawContent = {
  units,
  enemies,
  skills,
  ranges,
  stages: [stage1, stage2, stage3, stage4, stage5, stage6, stage7],
};
export const content = validateContent(rawContent);
