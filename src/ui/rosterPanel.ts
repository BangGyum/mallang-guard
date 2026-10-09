import { ROLE_COLORS, ROLE_NAMES } from '../art/palette';
import type { Battle } from '../sim/battle';
import { button, element } from './dom';
import { cardDeployReason } from './inputState';
import { placeRosterPopup } from './popupPosition';
import { portrait } from './portrait';
import { REJECTION_MESSAGES } from './toast';

export function createRosterPanel(root: HTMLDivElement, battle: Battle, close: () => void) {
  const panel = element('section', 'roster-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  const header = element('div', 'roster-header');
  const avatar = element('span', 'roster-avatar');
  const identity = element('div', 'roster-identity');
  const name = element('strong', 'roster-name');
  const role = element('span', 'roster-role');
  identity.append(name, role);
  const dismiss = button('×', close, 'roster-close');
  dismiss.setAttribute('aria-label', '배치 카드 정보 닫기');
  header.append(avatar, identity, dismiss);
  const details = element('div', 'roster-details');
  const stats = element('p', 'roster-stats');
  const skillName = element('strong', 'roster-skill-name');
  const skill = element('p', 'roster-skill-description');
  const charge = element('small', 'roster-charge');
  details.append(stats, skillName, skill, charge);
  const hint = element('p', 'roster-deploy-hint');
  panel.append(header, details, hint);
  root.append(panel);
  let selected: string | null = null;
  return {
    update(unitId: string | null) {
      const def = unitId && battle.content.units.get(unitId);
      const ability = def && battle.content.skills.get(def.skill);
      panel.hidden = !def || !ability;
      if (!def || !ability) {
        selected = null;
        delete panel.dataset.unitId;
        return;
      }
      if (selected !== unitId) {
        avatar.replaceChildren(portrait(def.art, ''));
        selected = unitId;
        panel.dataset.unitId = def.id;
        panel.setAttribute('aria-label', `${def.name} 배치 카드 정보`);
        panel.style.setProperty('--unit-color', ROLE_COLORS[def.role]);
        name.textContent = def.name;
        role.textContent = `${def.animal} · ${ROLE_NAMES[def.role]}`;
        const range = battle.content.ranges.get(def.range);
        stats.textContent = `배치 도토리 ${def.cost} · 재배치 ${def.redeploySec}초\n공격력 ${def.atk} · ${def.damageType === 'magic' ? '마법' : '물리'}\n공격 간격 ${def.atkIntervalSec.toFixed(2)}초 · ${def.canHitAir ? '대공 가능' : '지상 공격'}\n기본 사거리 ${range?.tiles.length ?? 0}칸 · 보라색 고지대`;
        skillName.textContent = ability.name;
        skill.textContent = ability.description;
        charge.textContent = `${ability.charge === 'auto' ? '시간 충전' : '공격 충전'} · ${ability.trigger === 'manual' ? '수동 발동' : '자동 발동'} · 시작 SP ${ability.spStart}/${ability.spCost}${ability.condition === 'enemyInRange' ? ' · 범위 내 적 필요' : ''}`;
      }
      const reason = cardDeployReason(battle, def.id);
      const message = reason ? REJECTION_MESSAGES[reason] : '높은 칸을 눌러 배치하거나 카드를 끌어놓으세요.';
      if (hint.textContent !== message) hint.textContent = message;
      panel.dataset.deployAvailable = String(reason === null);
      placeRosterPopup(root, panel);
    },
    dispose() {
      panel.remove();
    },
  };
}
