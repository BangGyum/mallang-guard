import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { createBattle } from '../sim/battle';
import type { SimEvent } from '../sim/types';
import { createController } from '../ui/controller';
import { createDeployBar } from '../ui/deployBar';
import { createHud } from '../ui/hud';
import { createBoardView, type ViewOptions } from '../view/boardView';
import { createOverlay } from '../view/overlay';
import { type LoopControls, startLoop } from './loop';
import { watchOrientation } from './orientation';
import { createQualityMonitor } from './quality';

export function createBattleSession(
  content: ContentDb,
  app: HTMLDivElement,
  actions: {
    speed: 1 | 2;
    options?: ViewOptions;
    automaticQuality?: boolean;
    onMenu(): void;
    onEnd(): void;
    onSpeed(speed: 1 | 2): void;
    onEvents?(events: readonly SimEvent[], speed: number): void;
    onAutoQuality?(): void;
  },
  images: ReadonlyMap<string, HTMLCanvasElement>,
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
  const view = createBoardView(canvas, battle.stage.board, content, images);
  const overlay = createOverlay(overlayCanvas, battle.stage.board, content);
  const controls: LoopControls = { paused: false, speed: actions.speed, bulletTime: false };
  let disposed = false;
  let ending = 0;
  const qualityMonitor = createQualityMonitor();
  if (actions.automaticQuality === false) qualityMonitor.stop();
  let options = actions.options ?? {
    quality: 'high',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  function setOptions(value: ViewOptions, manualQuality = false) {
    options = value;
    if (manualQuality) qualityMonitor.stop();
    view.setOptions(options);
    overlay.setOptions(options);
    overlay.resize();
  }
  setOptions(options);
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
      view.onEvents(events, battle.state);
      overlay.onEvents(events, view.entityPosition);
      actions.onEvents?.(events, controls.speed * (controls.bulletTime ? 0.25 : 1));
      controller.onEvents(events);
      if (events.some((event) => event.type === 'battleEnd')) {
        controller.setEnabled(false);
        controls.bulletTime = false;
        ending = 0.65;
      }
    },
    (alpha, dt, wallDt) => {
      const visualDt = ending > 0 ? wallDt * controls.speed : dt;
      controller.update();
      deployBar.update();
      hud.update(controls);
      view.render(battle.state, alpha, visualDt);
      overlay.render(battle.state, view.camera, alpha, visualDt);
      if (
        options.quality === 'high' &&
        !controls.paused &&
        battle.state.phase === 'running' &&
        qualityMonitor.sample(wallDt)
      ) {
        setOptions({ ...options, quality: 'low' });
        actions.onAutoQuality?.();
        hud.notify('부드러운 플레이를 위해 화면을 가볍게 바꿨어요. 설정에서 변경할 수 있어요.');
      }
      if (ending > 0) {
        ending = Math.max(0, ending - visualDt);
        if (ending === 0)
          queueMicrotask(() => {
            if (!disposed) {
              loop.dispose();
              actions.onEnd();
            }
          });
      }
    },
  );
  return {
    battle,
    view,
    controls,
    setOptions,
    setSpeed,
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
