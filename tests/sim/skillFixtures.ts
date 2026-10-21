import { applyCommand } from '../../src/sim/systems/commands';
import type { SimEvent } from '../../src/sim/types';
import { combatFixture, placeEnemy } from './combatFixtures';

export function skillFixture(unitId: string) {
  const f = combatFixture();
  const unit = f.state.units[0];
  const def = f.content.units.get(unitId);
  const skill = def && f.content.skills.get(def.skill);
  if (!unit || !skill) throw new Error('스킬 fixture 없음');
  unit.unitId = unitId;
  unit.sp = skill.spCost;
  unit.skillState = 'ready';
  const enemy = placeEnemy(f, 0.8, { hp: 10000, maxHp: 10000 });
  f.state.enemies = [enemy];
  const events: SimEvent[] = [];
  return {
    ...f,
    unit,
    skill,
    enemy,
    events,
    activate() {
      applyCommand(f.content, f.stage, f.state, { type: 'activateSkill', uid: unit.uid }, events);
    },
  };
}
