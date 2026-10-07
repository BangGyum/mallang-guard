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

export function createBattleSession(
  content: ContentDb,
  app: HTMLDivElement,
  actions: { speed: 1 | 2; onMenu(): void; onEnd(): void; onSpeed(speed: 1 | 2): void },
) {
  const oldCanvas = app.querySelector<HTMLCanvasElement>('#board');
  const overlayCanvas = app.querySelector<HTMLCanvasElement>('#overlay');
  const hudRoot = app.querySelector<HTMLDivElement>('#hud');
  assert(oldCanvas && overlayCanvas && hudRoot, '전투 화면 요소가 없습니다');
  // 이전 세션에서 해제한 WebGL 컨텍스트를 재사용하지 않습니다.
  const canvas = oldCanvas.cloneNode(false) as HTMLCanvasElement;
  oldCanvas.replaceWith(canvas);
  hudRoot.inert = false;
  const battle = createBattle(content, 'stage-1');
  const view = createBoardView(canvas, battle.stage.board, content, ROLE_COLORS);
  const overlay = createOverlay(overlayCanvas, battle.stage.board, content);
  const controls: LoopControls = { paused: false, speed: actions.speed, bulletTime: false };
  let disposed = false;
  function setSpeed(speed: 1 | 2) {
    controls.speed = speed;
    actions.onSpeed(speed);
  }
  const orientation = watchOrientation(app, controls);
  const hud = createHud(hudRoot, battle, {
    pause() {
      if (controls.paused) orientation.setPaused(false);
      else actions.onMenu();
    },
    speed() {
      setSpeed(controls.speed === 1 ? 2 : 1);
    },
  });
  const controller = createController(canvas, hudRoot, battle, view, {
    onModeChange(active) {
      controls.bulletTime = active;
    },
    pause() {
      orientation.setPaused(!controls.paused);
    },
    speed: setSpeed,
    menu: actions.onMenu,
    notify(message) {
      hud.notify(message);
    },
  });
  const deployBar = createDeployBar(hudRoot, battle, controller.startDrag);
  const observer = new ResizeObserver(() => {
    view.resize();
    overlay.resize();
    if (battle.state.phase !== 'running') {
      view.render(battle.state, 1, 0);
      overlay.render(battle.state, view.camera, 1);
    }
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
      if (events.some((event) => event.type === 'battleEnd'))
        queueMicrotask(() => {
          if (!disposed) {
            loop.dispose();
            actions.onEnd();
          }
        });
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
    setPaused: orientation.setPaused,
    setMenuOpen(open: boolean) {
      if (open) orientation.setPaused(true);
      controller.setEnabled(!open);
      hudRoot.inert = open;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      orientation.dispose();
      controller.dispose();
      deployBar.dispose();
      hud.dispose();
      observer.disconnect();
      overlay.dispose();
      view.dispose();
      hudRoot.inert = false;
    },
  };
}
