import { ROLE_NAMES } from '../art/palette';
import type { Battle } from '../sim/battle';
import { DP_MAX, RETREAT_REFUND_RATIO, TICK_RATE } from '../sim/constants';
import { unitStats } from '../sim/stats';
import { button, element } from './dom';

export function createUnitPanel(
  root: HTMLDivElement,
  battle: Battle,
  actions: { retreat(): void; activateSkill(): void },
) {
  const panel = element('div', 'unit-panel');
  panel.hidden = true;
  const name = element('strong', '');
  const description = element('p', 'unit-description');
  const stats = element('p', 'unit-stats');
  const skillName = element('b', 'skill-name');
  const skillDescription = element('p', 'skill-description');
  const gauge = element('progress', 'skill-gauge');
  gauge.setAttribute('aria-label', '스킬 충전');
  const status = element('p', 'skill-status');
  status.setAttribute('role', 'status');
  const activate = button('스킬 발동', actions.activateSkill, 'skill-button');
  const retreat = button('후퇴', actions.retreat);
  panel.append(name, description, stats, skillName, skillDescription, gauge, status, activate, retreat);
  root.append(panel);
  return {
    update(uid: number | null) {
      const unit = battle.state.units.find((entry) => entry.uid === uid);
      const def = unit && battle.content.units.get(unit.unitId);
      const skill = def && battle.content.skills.get(def.skill);
      panel.hidden = !unit || !def || !skill;
      if (!unit || !def || !skill) return;
      const current = unitStats(battle.content, battle.stage, battle.state, unit);
      name.textContent = def.name;
      description.textContent = `${def.animal} · ${ROLE_NAMES[def.role]} · 고지대`;
      stats.textContent =
        '공격 ' +
        Math.round(current.atk) +
        ' · ' +
        (current.atkIntervalTicks / TICK_RATE).toFixed(1) +
        '초 간격';
      skillName.textContent = skill.name;
      skillDescription.textContent = skill.description;
      const active = unit.skillState === 'active';
      const ready = unit.skillState === 'ready';
      panel.dataset.skillState = unit.skillState;
      gauge.max = active ? skill.durationSec : skill.spCost;
      gauge.value = active ? Math.max(0, unit.skillEndTick - battle.state.tick) / TICK_RATE : unit.sp;
      status.textContent = active
        ? `발동 중 · ${gauge.value.toFixed(1)}초`
        : ready
          ? skill.trigger === 'auto'
            ? '자동 발동 대기 · 범위 안 적 필요'
            : '사용 준비 완료'
          : 'SP ' +
            Math.floor(unit.sp) +
            '/' +
            skill.spCost +
            (skill.charge === 'attack' ? ' · 공격 충전' : ' · 자동 충전');
      activate.hidden = skill.trigger === 'auto';
      activate.disabled = !ready || battle.state.phase !== 'running';
      activate.textContent = active ? '스킬 사용 중' : ready ? '스킬 발동' : '스킬 충전 중';
      const refund = Math.min(DP_MAX - battle.state.dp, Math.floor(def.cost * RETREAT_REFUND_RATIO));
      retreat.textContent = `후퇴 (+${refund}🌰)`;
      retreat.disabled = battle.state.phase !== 'running';
    },
    dispose() {
      panel.remove();
    },
  };
}
