import { createSfx } from '../audio/sfx';
import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { createPauseMenu } from '../ui/pauseMenu';
import { createResultScreen } from '../ui/resultScreen';
import { createSettings } from '../ui/settings';
import { createTitleScreen } from '../ui/titleScreen';
import { impactDelays } from '../view/eventTiming';
import { createBattleSession } from './battleSession';
import { loadSave, storeSave } from './save';

export function createApp(
  content: ContentDb,
  app: HTMLDivElement,
  images: ReadonlyMap<string, HTMLCanvasElement>,
) {
  const screenRoot = app.querySelector<HTMLDivElement>('#screens');
  const stageDef = content.stages.get('stage-1');
  assert(screenRoot && stageDef, '시작 화면을 불러올 수 없습니다');
  const root = screenRoot;
  const stage = stageDef;
  const save = loadSave();
  const sound = createSfx(save.settings.sfxVolume);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let automaticQuality = true;
  let session: ReturnType<typeof createBattleSession> | undefined;
  let screen: { dispose(): void } | undefined;
  function viewOptions() {
    return {
      quality: save.settings.quality,
      reducedMotion: save.settings.reducedMotion ?? motionQuery.matches,
    };
  }
  function applySettings(manualQuality = false) {
    app.dataset.reducedMotion = String(viewOptions().reducedMotion);
    sound.setVolume(save.settings.sfxVolume);
    session?.setOptions(viewOptions(), manualQuality);
  }
  const onMotionChange = () => applySettings();
  motionQuery.addEventListener('change', onMotionChange);
  function showSettings() {
    const fromBattle = !!session;
    if (fromBattle) clearScreen();
    const background = screen;
    const settings = createSettings(root, save.settings, {
      change(value, manualQuality) {
        if (manualQuality) automaticQuality = false;
        save.settings = value;
        storeSave(save);
        applySettings(manualQuality);
        session?.setSpeed(value.speed);
      },
      preview: () => sound.play('deploy'),
      close() {
        if (fromBattle) showPause();
        else showTitle();
      },
    });
    screen = {
      dispose() {
        settings.dispose();
        background?.dispose();
      },
    };
  }
  function clearScreen() {
    screen?.dispose();
    screen = undefined;
  }
  function setBattleVisible(visible: boolean) {
    for (const node of app.querySelectorAll<HTMLElement>('#board, #overlay, #hud')) node.hidden = !visible;
  }
  function showTitle() {
    sound.reset();
    clearScreen();
    session?.dispose();
    session = undefined;
    setBattleVisible(false);
    app.dataset.screen = 'title';
    screen = createTitleScreen(root, content, stage.name, save.stages[stage.id], startBattle, showSettings);
  }
  function closePause(resume: boolean) {
    clearScreen();
    session?.setMenuOpen(false);
    session?.setPaused(!resume);
    app.dataset.screen = 'battle';
  }
  function showPause() {
    if (session?.battle.state.phase !== 'running') return;
    sound.stop();
    clearScreen();
    session.setMenuOpen(true);
    app.dataset.screen = 'paused';
    screen = createPauseMenu(root, {
      resume: () => closePause(true),
      deployPaused: () => closePause(false),
      restart: startBattle,
      exit: showTitle,
      settings: showSettings,
    });
  }
  function showResult() {
    if (!session) return;
    const state = session.battle.state;
    const won = state.phase === 'won';
    if (won) {
      save.stages[stage.id] = {
        cleared: true,
        bestLife: Math.max(save.stages[stage.id]?.bestLife ?? 0, state.life),
      };
      storeSave(save);
    }
    clearScreen();
    session.setMenuOpen(true);
    app.dataset.screen = 'result';
    screen = createResultScreen(
      root,
      {
        won,
        life: state.life,
        killed: state.killed,
        totalEnemies: state.totalEnemies,
        bestLife: save.stages[stage.id]?.bestLife ?? 0,
      },
      { restart: startBattle, exit: showTitle },
    );
  }
  function startBattle() {
    sound.reset();
    clearScreen();
    session?.dispose();
    setBattleVisible(true);
    app.dataset.screen = 'battle';
    session = createBattleSession(
      content,
      app,
      {
        speed: save.settings.speed,
        options: viewOptions(),
        automaticQuality,
        onMenu: showPause,
        onEnd: showResult,
        onEvents(events) {
          sound.onEvents(events, impactDelays(events));
        },
        onFrame: sound.update,
        onAutoQuality() {
          save.settings.quality = 'low';
          storeSave(save);
        },
        onSpeed(speed) {
          save.settings.speed = speed;
          storeSave(save);
        },
      },
      images,
    );
  }
  applySettings();
  showTitle();
  return {
    dispose() {
      clearScreen();
      session?.dispose();
      sound.dispose();
      motionQuery.removeEventListener('change', onMotionChange);
      setBattleVisible(false);
      delete app.dataset.screen;
      delete app.dataset.reducedMotion;
    },
  };
}
