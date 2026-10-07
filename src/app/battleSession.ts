import { ROLE_COLORS } from '../art/palette';
import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { createBattle } from '../sim/battle';
import { createBoardView } from '../view/boardView';
import { createOverlay } from '../view/overlay';
import { type LoopControls, startLoop } from './loop';

export function createBattleSession(content: ContentDb, app: HTMLDivElement) {
  const canvas = app.querySelector<HTMLCanvasElement>('#board');
  const overlayCanvas = app.querySelector<HTMLCanvasElement>('#overlay');
  assert(canvas && overlayCanvas, '전투 화면 요소가 없습니다');
  const battle = createBattle(content, 'stage-1');
  const view = createBoardView(canvas, battle.stage.board, content, ROLE_COLORS);
  const overlay = createOverlay(overlayCanvas, battle.stage.board);
  const controls: LoopControls = { paused: false, speed: 1, bulletTime: false };
  const observer = new ResizeObserver(() => {
    view.resize();
    overlay.resize();
  });
  observer.observe(app);
  view.resize();
  overlay.resize();
  const loop = startLoop(
    battle,
    controls,
    (events) => view.onEvents(events),
    (alpha, dt) => {
      view.render(battle.state, alpha, dt);
      overlay.render(battle.state, view.camera, alpha);
    },
  );
  return {
    battle,
    view,
    controls,
    dispose() {
      loop.dispose();
      observer.disconnect();
      overlay.dispose();
      view.dispose();
    },
  };
}
