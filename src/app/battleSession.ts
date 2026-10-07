import { ROLE_COLORS } from '../art/palette';
import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { createBattle } from '../sim/battle';
import { createController } from '../ui/controller';
import { createDeployBar } from '../ui/deployBar';
import { createHud } from '../ui/hud';
import { createBoardView } from '../view/boardView';
import { createOverlay } from '../view/overlay';
import { type LoopControls, startLoop } from './loop';
import { watchOrientation } from './orientation';

export function createBattleSession(content: ContentDb, app: HTMLDivElement) {
  const canvas = app.querySelector<HTMLCanvasElement>('#board');
  const overlayCanvas = app.querySelector<HTMLCanvasElement>('#overlay');
  const hudRoot = app.querySelector<HTMLDivElement>('#hud');
  assert(canvas && overlayCanvas && hudRoot, '전투 화면 요소가 없습니다');
  const battle = createBattle(content, 'stage-1');
  const view = createBoardView(canvas, battle.stage.board, content, ROLE_COLORS);
  const overlay = createOverlay(overlayCanvas, battle.stage.board);
  const controls: LoopControls = { paused: false, speed: 1, bulletTime: false };
  const orientation = watchOrientation(app, controls);
  const hud = createHud(hudRoot, battle, {
    pause() {
      controls.paused = !controls.paused;
    },
    speed() {
      controls.speed = controls.speed === 1 ? 2 : 1;
    },
    restart() {
      window.location.reload();
    },
  });
  const controller = createController(canvas, hudRoot, battle, view, {
    onModeChange(active) {
      controls.bulletTime = active;
    },
    pause() {
      controls.paused = !controls.paused;
    },
    speed(value) {
      controls.speed = value;
    },
    notify(message) {
      hud.notify(message);
    },
  });
  const deployBar = createDeployBar(hudRoot, battle, controller.startDrag);
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
    (events) => {
      view.onEvents(events);
      controller.onEvents(events);
    },
    (alpha, dt) => {
      controller.update();
      deployBar.update();
      hud.update(controls);
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
      orientation.dispose();
      controller.dispose();
      deployBar.dispose();
      hud.dispose();
      observer.disconnect();
      overlay.dispose();
      view.dispose();
    },
  };
}
