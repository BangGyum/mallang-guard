import enemies from './enemies.json';
import ranges from './ranges.json';
import skills from './skills.json';
import stage1 from './stages/stage-1.json';
import units from './units.json';
import { validateContent } from './validate';

export const content = validateContent({ units, enemies, skills, ranges, stages: [stage1] });
