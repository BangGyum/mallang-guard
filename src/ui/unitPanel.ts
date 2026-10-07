import { ROLE_NAMES } from '../art/palette';
import type { Battle } from '../sim/battle';
import { DP_MAX, RETREAT_REFUND_RATIO } from '../sim/constants';
import { button, element } from './dom';

export function createUnitPanel(root: HTMLDivElement, battle: Battle, onRetreat: () => void) {
  const panel = element('div', 'unit-panel');
  panel.hidden = true;
  const name = element('strong', '');
  const description = element('p', '');
  const hp = element('p', '');
  const stats = element('p', '');
  const retreat = button('후퇴', onRetreat);
  panel.append(name, description, hp, stats, retreat);
  root.append(panel);
  return {
    update(uid: number | null) {
      const unit = battle.state.units.find((entry) => entry.uid === uid);
      const def = unit && battle.content.units.get(unit.unitId);
      panel.hidden = !unit || !def;
      if (!unit || !def) return;
      name.textContent = def.name;
      description.textContent = `${def.animal} · ${ROLE_NAMES[def.role]}`;
      hp.textContent = `HP ${Math.ceil(Math.max(0, unit.hp))} / ${unit.maxHp}`;
      stats.textContent = `공격 ${def.atk} · 방어 ${def.def} · 저지 ${def.block}`;
      const refund = Math.min(DP_MAX - battle.state.dp, Math.floor(def.cost * RETREAT_REFUND_RATIO));
      retreat.textContent = `후퇴 (+${refund}🌰)`;
      retreat.disabled = battle.state.phase !== 'running';
    },
    dispose() {
      panel.remove();
    },
  };
}
