import type { Dir } from '../core/grid';
import type { Battle } from '../sim/battle';
import type { SimEvent } from '../sim/types';
import type { BoardView } from '../view/boardView';
import { pickTile, tileScreen } from '../view/picking';
import { button, element } from './dom';
import { cardDeployReason, directionFromDrag, type InputState, isCardDrag } from './inputState';
import { createRosterPanel } from './rosterPanel';
import { selectionHighlights } from './selectionHighlights';
import { createSkillNotices } from './skillNotices';
import { REJECTION_MESSAGES } from './toast';
import { createUnitPanel } from './unitPanel';

interface Actions {
  onModeChange(active: boolean): void;
  pause(): void;
  menu(): void;
  speed(value: 1 | 2): void;
  notify(message: string): void;
}
export function createController(
  canvas: HTMLCanvasElement,
  root: HTMLDivElement,
  battle: Battle,
  view: BoardView,
  actions: Actions,
) {
  let state: InputState = { mode: 'idle' };
  let enabled = true;
  let pointerId: number | null = null;
  let captureTarget: HTMLElement | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let pressX = 0;
  let pressY = 0;
  let cardPanX = false;
  const directions = element('div', 'aim-directions');
  directions.hidden = true;
  directions.setAttribute('aria-label', '배치 방향 선택');
  const ghost = element('div', 'drag-ghost');
  ghost.hidden = true;
  const panel = createUnitPanel(root, battle, {
    retreat() {
      if (state.mode === 'selected') battle.enqueue({ type: 'retreat', uid: state.uid });
      transition({ mode: 'idle' });
    },
    activateSkill() {
      if (state.mode === 'selected') battle.enqueue({ type: 'activateSkill', uid: state.uid });
    },
    close() {
      transition({ mode: 'idle' });
    },
  });
  const notices = createSkillNotices(root, canvas, battle, view);
  const rosterPanel = createRosterPanel(root, battle, () => transition({ mode: 'idle' }));
  const arrows = new Map<Dir, HTMLButtonElement>();
  for (const [dir, symbol, name] of [
    ['up', '↑', '위'],
    ['left', '←', '왼쪽'],
    ['right', '→', '오른쪽'],
    ['down', '↓', '아래'],
  ] as const) {
    const arrow = button(symbol, () => commit(dir), `aim-${dir}`);
    arrow.setAttribute('aria-label', `${name} 방향으로 배치`);
    arrow.dataset.dir = dir;
    arrow.addEventListener('pointerenter', () => {
      if (state.mode === 'aiming') state = { ...state, dir };
    });
    directions.append(arrow);
    arrows.set(dir, arrow);
  }
  const cancel = button('×', () => transition({ mode: 'idle' }), 'aim-cancel');
  cancel.setAttribute('aria-label', '배치 취소');
  directions.append(cancel);
  root.append(directions, ghost);
  function transition(next: InputState) {
    state = next;
    for (const card of root.querySelectorAll<HTMLElement>('.deploy-card'))
      card.dataset.selected = String(next.mode === 'preview' && card.dataset.unitId === next.unitId);
    actions.onModeChange(next.mode !== 'idle');
  }
  function releasePointer() {
    const id = pointerId;
    pointerId = null;
    if (id !== null && captureTarget?.hasPointerCapture(id)) captureTarget.releasePointerCapture(id);
    captureTarget = null;
  }
  function capture(event: PointerEvent, target: HTMLElement) {
    pointerId = event.pointerId;
    captureTarget = target;
    target.setPointerCapture(event.pointerId);
    pointerX = event.clientX;
    pointerY = event.clientY;
    pressX = pointerX;
    pressY = pointerY;
    cardPanX = event.pointerType === 'touch' && getComputedStyle(target).touchAction === 'pan-x';
  }
  function tileAt(event: PointerEvent) {
    return pickTile(canvas, view.camera, battle.stage.board, event.clientX, event.clientY);
  }
  function commit(dir: Dir) {
    if (state.mode !== 'aiming') return;
    battle.enqueue({ type: 'deploy', unitId: state.unitId, tile: state.tile, dir });
    releasePointer();
    transition({ mode: 'idle' });
  }
  function onDown(event: PointerEvent) {
    if (
      !enabled ||
      pointerId !== null ||
      !event.isPrimary ||
      event.button !== 0 ||
      battle.state.phase !== 'running'
    )
      return;
    event.preventDefault();
    if (state.mode === 'aiming') {
      const tile = tileAt(event);
      if (!tile || Math.hypot(tile.x - state.tile.x, tile.y - state.tile.y) >= 3) {
        transition({ mode: 'idle' });
        return;
      }
    }
    capture(event, canvas);
    if (state.mode === 'dragging') state = { ...state, hover: tileAt(event) };
  }
  function onMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (
      state.mode === 'preview' &&
      captureTarget !== canvas &&
      isCardDrag(pointerX - pressX, pointerY - pressY, cardPanX)
    ) {
      const reason = cardDeployReason(battle, state.unitId);
      if (reason) {
        actions.notify(REJECTION_MESSAGES[reason]);
        releasePointer();
        return;
      }
      const unitId = state.unitId;
      transition({ mode: 'dragging', unitId, hover: null });
      const art = battle.content.units.get(unitId)?.art;
      if (art) ghost.innerHTML = critterSvg(art);
    }
    if (state.mode === 'dragging') state = { ...state, hover: tileAt(event) };
    if (state.mode === 'aiming') {
      const center = tileScreen(canvas, view.camera, battle.stage.board, state.tile);
      const dir = directionFromDrag(event.clientX - center.x, event.clientY - center.y);
      if (dir) state = { ...state, dir };
    }
  }
  function onUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const fromCard = captureTarget !== canvas;
    releasePointer();
    const tile = tileAt(event);
    if (state.mode === 'dragging') {
      const check = tile && battle.checkDeploy(state.unitId, tile);
      if (tile && check?.ok) transition({ mode: 'aiming', unitId: state.unitId, tile, dir: null });
      else {
        if (check && !check.ok) actions.notify(REJECTION_MESSAGES[check.reason]);
        transition({ mode: 'idle' });
      }
    } else if (state.mode === 'aiming') {
      if (state.dir) commit(state.dir);
    } else if (state.mode === 'preview' && fromCard) {
      return;
    } else if (state.mode === 'preview' && tile && !battle.unitAt(tile)) {
      const check = battle.checkDeploy(state.unitId, tile);
      if (check.ok) transition({ mode: 'aiming', unitId: state.unitId, tile, dir: null });
      else actions.notify(REJECTION_MESSAGES[check.reason]);
    } else {
      const unit = tile && battle.unitAt(tile);
      transition(unit ? { mode: 'selected', uid: unit.uid } : { mode: 'idle' });
    }
  }
  function onCancel(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      releasePointer();
      transition({ mode: 'idle' });
    }
  }
  function onKey(event: KeyboardEvent) {
    if (!enabled) return;
    if (event.key === 'Escape') {
      const wasIdle = state.mode === 'idle';
      releasePointer();
      transition({ mode: 'idle' });
      if (wasIdle && battle.state.phase === 'running') actions.menu();
      event.preventDefault();
      return;
    }
    if (
      state.mode !== 'aiming' &&
      event.target instanceof HTMLButtonElement &&
      (event.code === 'Space' || event.key === 'Enter')
    )
      return;
    if (event.code === 'Space') {
      event.preventDefault();
      actions.pause();
    }
    if (event.key === '1' || event.key === '2') actions.speed(event.key === '1' ? 1 : 2);
    if (state.mode !== 'aiming') return;
    const keyDirs: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const dir = keyDirs[event.key];
    if (dir) {
      event.preventDefault();
      state = { ...state, dir };
    }
    if (event.key === 'Enter' && state.dir) {
      event.preventDefault();
      commit(state.dir);
    }
  }
  canvas.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey);
  return {
    selectCard(unitId: string, event?: PointerEvent) {
      if (!enabled || (!event && state.mode === 'aiming')) return;
      if (pointerId !== null || (event && (!event.isPrimary || event.button !== 0))) return;
      if (battle.state.phase !== 'running') return;
      if (event && event.currentTarget instanceof HTMLElement) {
        event.preventDefault();
        capture(event, event.currentTarget);
      }
      transition({ mode: 'preview', unitId });
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) {
        releasePointer();
        transition({ mode: 'idle' });
      }
    },
    onEvents(events: readonly SimEvent[]) {
      notices.onEvents(events);
      for (const event of events)
        if (event.type === 'commandRejected') actions.notify(REJECTION_MESSAGES[event.reason]);
    },
    update() {
      const selectedUid = state.mode === 'selected' ? state.uid : null;
      if (
        battle.state.phase !== 'running' ||
        (state.mode === 'selected' && !battle.state.units.some((unit) => unit.uid === selectedUid))
      ) {
        releasePointer();
        transition({ mode: 'idle' });
      }
      const highlights = selectionHighlights(battle, state);
      if (state.mode === 'aiming') {
        const center = tileScreen(canvas, view.camera, battle.stage.board, state.tile);
        const rect = root.getBoundingClientRect();
        directions.style.left = `${Math.max(72, Math.min(rect.width - 72, center.x - rect.left))}px`;
        directions.style.top = `${Math.max(90, Math.min(rect.height - 90, center.y - rect.top))}px`;
        for (const [dir, arrow] of arrows) arrow.classList.toggle('is-active', dir === state.dir);
      }
      directions.hidden = state.mode !== 'aiming';
      ghost.hidden = state.mode !== 'dragging' || !!state.hover;
      if (state.mode === 'dragging') ghost.style.translate = `${pointerX - 40}px ${pointerY - 64}px`;
      const selected =
        state.mode === 'selected' ? battle.state.units.find((unit) => unit.uid === selectedUid) : undefined;
      panel.update(
        selected?.uid ?? null,
        selected ? tileScreen(canvas, view.camera, battle.stage.board, selected.tile) : null,
      );
      rosterPanel.update(state.mode === 'preview' ? state.unitId : null);
      notices.update();
      view.setHighlights(highlights);
    },
    dispose() {
      releasePointer();
      actions.onModeChange(false);
      canvas.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKey);
      panel.dispose();
      rosterPanel.dispose();
      notices.dispose();
      directions.remove();
      ghost.remove();
    },
  };
}

import { critterSvg } from '../art/critters';
