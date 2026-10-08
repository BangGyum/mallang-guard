import { critterSvg } from '../art/critters';
import { ROLE_COLORS, ROLE_NAMES } from '../art/palette';
import type { Battle } from '../sim/battle';
import { DP_MAX, RETREAT_REFUND_RATIO, TICK_RATE } from '../sim/constants';
import { unitStats } from '../sim/stats';
import { acornIcon } from './acornIcon';
import { button, element } from './dom';
import { reducedMotion } from './motion';
import { placeUnitPopup, type ScreenPoint } from './popupPosition';

export function createUnitPanel(
  root: HTMLDivElement,
  battle: Battle,
  actions: { retreat(): void; activateSkill(): void; close(): void },
) {
  const panel = element('div', 'unit-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  const card = element('div', 'unit-popup-card');
  const header = element('div', 'unit-popup-header');
  const avatar = element('span', 'unit-popup-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const identity = element('div', 'unit-popup-identity');
  const name = element('strong', 'unit-popup-name');
  const description = element('p', 'unit-description');
  const close = button('×', actions.close, 'unit-popup-close');
  close.setAttribute('aria-label', '캐릭터 정보 닫기');
  identity.append(name, description);
  header.append(avatar, identity, close);
  const skillName = element('b', 'skill-name');
  const details = element('div', 'unit-info-details');
  const stats = element('p', 'unit-stats');
  const skillDescription = element('p', 'skill-description');
  const disruption = element('p', 'unit-disruption');
  const gauge = element('progress', 'skill-gauge');
  gauge.setAttribute('aria-label', '스킬 충전');
  const status = element('p', 'skill-status');
  const activate = button('스킬 발동', actions.activateSkill, 'skill-button');
  const retreat = button('', actions.retreat, 'unit-retreat');
  const refundAmount = element('span', '');
  retreat.append('후퇴 (+', refundAmount, acornIcon(), ')');
  const buttons = element('div', 'unit-popup-actions');
  buttons.append(activate, retreat);
  details.append(stats, skillDescription, disruption);
  card.append(header, skillName, details, status, gauge, buttons);
  panel.append(card);
  const marker = element('div', 'unit-popup-anchor');
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  root.append(marker, panel);
  let selectedUid: number | null = null;
  return {
    update(uid: number | null, point: ScreenPoint | null) {
      const unit = battle.state.units.find((entry) => entry.uid === uid);
      const def = unit && battle.content.units.get(unit.unitId);
      const skill = def && battle.content.skills.get(def.skill);
      panel.hidden = marker.hidden = !unit || !def || !skill || !point;
      if (!unit || !def || !skill || !point) {
        selectedUid = null;
        return;
      }
      if (selectedUid !== uid) {
        avatar.innerHTML = critterSvg(def.art);
        // 유닛 전환 시에도 짧게 열리지만, 매 프레임 애니메이션을 재시작하지 않습니다.
        for (const animation of card.getAnimations()) animation.cancel();
        if (!reducedMotion())
          card.animate(
            [
              { opacity: 0, transform: 'translateY(6px) scale(.96)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 160, easing: 'ease-out' },
          );
        selectedUid = uid;
      }
      panel.dataset.unitId = def.id;
      panel.setAttribute('aria-label', `${def.name} 캐릭터 정보`);
      name.textContent = def.name;
      for (const node of [panel, marker]) node.style.setProperty('--unit-color', ROLE_COLORS[def.role]);
      description.textContent = `${def.animal} · ${ROLE_NAMES[def.role]} · ${skill.trigger === 'auto' ? '자동 발동' : '수동 발동'}`;
      const current = unitStats(battle.content, battle.stage, battle.state, unit);
      stats.textContent = `공격력 ${Math.round(current.atk)} · ${def.damageType === 'magic' ? '마법' : '물리'}\n공격 간격 ${(current.atkIntervalTicks / TICK_RATE).toFixed(2)}초 · ${def.canHitAir ? '대공 가능' : '지상 공격'}`;
      skillName.textContent = skill.name;
      skillDescription.textContent = skill.description;
      disruption.hidden = unit.disruptedUntilTick <= battle.state.tick;
      disruption.textContent = `끈적함 · 공격 느림 ${Math.max(0, (unit.disruptedUntilTick - battle.state.tick) / TICK_RATE).toFixed(1)}초`;
      const active = unit.skillState === 'active';
      const ready = unit.skillState === 'ready';
      panel.dataset.skillState = unit.skillState;
      gauge.max = active ? skill.durationSec : skill.spCost;
      gauge.value = active ? Math.max(0, unit.skillEndTick - battle.state.tick) / TICK_RATE : unit.sp;
      status.textContent = active
        ? `발동 중 · ${gauge.value.toFixed(1)}초`
        : ready
          ? skill.trigger === 'auto'
            ? '자동 발동 대기 · 적을 기다려요'
            : '준비 완료 · 지금 사용할 수 있어요'
          : `SP ${Math.floor(unit.sp)}/${skill.spCost} · ${skill.charge === 'attack' ? '공격할 때 충전' : '충전 중'}`;
      activate.hidden = skill.trigger === 'auto';
      activate.disabled = !ready || battle.state.phase !== 'running';
      activate.textContent = active ? '스킬 사용 중' : ready ? '스킬 발동' : '스킬 충전 중';
      const refund = Math.min(DP_MAX - battle.state.dp, Math.floor(def.cost * RETREAT_REFUND_RATIO));
      refundAmount.textContent = String(refund);
      retreat.setAttribute('aria-label', `후퇴, 도토리 ${refund}개 환급`);
      retreat.disabled = battle.state.phase !== 'running';
      const anchor = placeUnitPopup(root, panel, point);
      marker.style.left = `${anchor.x}px`;
      marker.style.top = `${anchor.y}px`;
    },
    dispose() {
      panel.remove();
      marker.remove();
    },
  };
}
