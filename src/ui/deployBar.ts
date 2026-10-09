import { ROLE_COLORS, ROLE_NAMES } from '../art/palette';
import { assert } from '../core/assert';
import type { Battle } from '../sim/battle';
import { ticksPerDp } from '../sim/systems/dp';
import { acornIcon } from './acornIcon';
import { element } from './dom';
import { portrait } from './portrait';

export function createDeployBar(
  root: HTMLDivElement,
  battle: Battle,
  onCardDown: (unitId: string, event?: PointerEvent) => void,
) {
  const bar = element('div', 'deploy-bar');
  const remaining = element('span', 'deploy-remaining');
  const cards = element('div', 'deploy-cards');
  const dp = element('div', 'dp-panel');
  const amount = element('strong', '');
  const progress = element('progress', '');
  progress.max = 1;
  progress.setAttribute('aria-label', '다음 도토리까지');
  const dpLabel = element('span', '', '도토리');
  dpLabel.prepend(acornIcon());
  dp.append(dpLabel, amount, progress);
  bar.append(remaining, cards, dp);
  root.append(bar);
  const entries = battle.state.roster
    .map((slot, order) => ({ slot, order }))
    .sort(
      (a, b) =>
        (battle.content.units.get(a.slot.unitId)?.cost ?? 0) -
          (battle.content.units.get(b.slot.unitId)?.cost ?? 0) || a.order - b.order,
    );
  const buttons = new Map<string, { card: HTMLButtonElement; status: HTMLSpanElement }>();
  for (const { slot } of entries) {
    const def = battle.content.units.get(slot.unitId);
    assert(def, '배치 카드 콘텐츠가 없습니다');
    const card = element('button', 'deploy-card');
    card.type = 'button';
    card.dataset.unitId = def.id;
    card.setAttribute('aria-label', `${def.name} 정보와 배치, 도토리 ${def.cost}`);
    card.style.setProperty('--role-color', ROLE_COLORS[def.role]);
    const status = element('span', 'card-status');
    const cost = element('span', 'card-cost', String(def.cost));
    cost.prepend(acornIcon());
    card.append(
      cost,
      portrait(def.art, 'card-portrait'),
      element('strong', 'card-name', def.name),
      element('span', 'card-role', ROLE_NAMES[def.role]),
      status,
    );
    const select = (event?: PointerEvent) => {
      onCardDown(def.id, event);
    };
    card.addEventListener('pointerdown', select);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        select();
      }
    });
    cards.append(card);
    buttons.set(def.id, { card, status });
  }
  return {
    update() {
      const left = battle.stage.definition.deployLimit - battle.state.units.length;
      remaining.textContent = `남은 배치 ${left}`;
      remaining.classList.toggle('is-full', left <= 0);
      amount.textContent = String(battle.state.dp);
      progress.value = battle.state.dpTicks / ticksPerDp(battle.stage);
      for (const info of battle.rosterView()) {
        const entry = buttons.get(info.unitId);
        if (!entry) continue;
        entry.card.hidden = info.state === 'deployed';
        entry.card.dataset.state = info.state;
        entry.card.classList.toggle(
          'is-unavailable',
          info.state !== 'ready' || left <= 0 || battle.state.phase !== 'running',
        );
        entry.status.textContent =
          info.state === 'cooldown'
            ? `대기 ${Math.ceil(info.cooldownSec)}초`
            : info.state === 'noDp'
              ? '도토리 부족'
              : left <= 0
                ? '배치 가득'
                : '';
        entry.card.dataset.deployAvailable = String(
          info.state === 'ready' && left > 0 && battle.state.phase === 'running',
        );
      }
    },
    dispose() {
      bar.remove();
    },
  };
}
