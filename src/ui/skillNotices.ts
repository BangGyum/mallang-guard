import { ROLE_COLORS } from '../art/palette';
import { clamp } from '../core/math';
import type { Battle } from '../sim/battle';
import type { SimEvent } from '../sim/types';
import type { BoardView } from '../view/boardView';
import { tileScreen } from '../view/picking';
import { element } from './dom';
import { popupBounds } from './popupPosition';

export function createSkillNotices(
  root: HTMLDivElement,
  canvas: HTMLCanvasElement,
  battle: Battle,
  view: BoardView,
) {
  const notices = new Map<number, { node: HTMLDivElement; timer: ReturnType<typeof setTimeout> }>();
  const announcer = element('span', 'skill-announcer');
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  root.append(announcer);
  function remove(uid: number) {
    const notice = notices.get(uid);
    if (!notice) return;
    clearTimeout(notice.timer);
    notice.node.remove();
    notices.delete(uid);
  }
  return {
    onEvents(events: readonly SimEvent[]) {
      for (const event of events) {
        if (event.type === 'unitRetreat') remove(event.uid);
        if (event.type !== 'skillStart') continue;
        const unit = battle.state.units.find((entry) => entry.uid === event.uid);
        const def = unit && battle.content.units.get(unit.unitId);
        const skill = battle.content.skills.get(event.skillId);
        if (!unit || !def || !skill) continue;
        remove(unit.uid);
        const node = element('div', 'skill-notice');
        node.dataset.unitId = def.id;
        node.style.setProperty('--unit-color', ROLE_COLORS[def.role]);
        node.setAttribute('aria-hidden', 'true');
        node.append(
          element('span', '', `${def.name} · ${skill.trigger === 'auto' ? '자동 발동' : '스킬 발동'}`),
          element('strong', '', `✦ ${skill.name}`),
        );
        root.append(node);
        announcer.textContent = `${def.name}, ${skill.name} 발동`;
        notices.set(unit.uid, { node, timer: setTimeout(() => remove(unit.uid), 1900) });
      }
    },
    update() {
      if (notices.size === 0) return;
      const rect = root.getBoundingClientRect();
      const bounds = popupBounds(root);
      const placed: { left: number; top: number; width: number; height: number }[] = [];
      const gap = rect.height <= 500 ? 16 : 50;
      for (const unit of battle.state.units) {
        const point = tileScreen(canvas, view.camera, battle.stage.board, unit.tile);
        placed.push({
          left: point.x - rect.left - gap,
          top: point.y - rect.top - gap * 2,
          width: gap * 2,
          height: gap * 2 + 8,
        });
      }
      const panel = root.querySelector<HTMLElement>('.unit-panel');
      if (panel && !panel.hidden)
        placed.push({
          left: panel.offsetLeft,
          top: panel.offsetTop,
          width: panel.offsetWidth,
          height: panel.offsetHeight,
        });
      for (const [uid, notice] of notices) {
        const unit = battle.state.units.find((entry) => entry.uid === uid);
        if (!unit || battle.state.phase !== 'running') {
          remove(uid);
          continue;
        }
        const at = tileScreen(canvas, view.camera, battle.stage.board, unit.tile);
        const width = notice.node.offsetWidth;
        const height = notice.node.offsetHeight;
        const x = at.x - rect.left;
        const y = at.y - rect.top;
        const candidates = [
          { left: x - width / 2, top: y - gap * 2 - height - 6 },
          { left: x + gap + 8, top: y - gap - height / 2 },
          { left: x - gap - width - 8, top: y - gap - height / 2 },
          { left: x - width / 2, top: y + 16 },
        ];
        if (panel && !panel.hidden)
          candidates.push({
            left:
              x < panel.offsetLeft + panel.offsetWidth / 2
                ? panel.offsetLeft - width - 8
                : panel.offsetLeft + panel.offsetWidth + 8,
            top: y + 16,
          });
        const positions = candidates.map((candidate) => ({
          left: clamp(candidate.left, bounds.left, bounds.right - width),
          top: clamp(candidate.top, bounds.top, bounds.bottom - height),
        }));
        const overlap = (candidate: { left: number; top: number }) =>
          placed.reduce(
            (area, other) =>
              area +
              Math.max(
                0,
                Math.min(candidate.left + width, other.left + other.width) -
                  Math.max(candidate.left, other.left),
              ) *
                Math.max(
                  0,
                  Math.min(candidate.top + height, other.top + other.height) -
                    Math.max(candidate.top, other.top),
                ),
            0,
          );
        positions.sort((a, b) => overlap(a) - overlap(b));
        const { left, top } = positions[0] ?? { left: x, top: y };
        notice.node.style.left = `${left}px`;
        notice.node.style.top = `${top}px`;
        placed.push({ left, top, width, height });
      }
    },
    dispose() {
      for (const uid of notices.keys()) remove(uid);
      announcer.remove();
    },
  };
}
