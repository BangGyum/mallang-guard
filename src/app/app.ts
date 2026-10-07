import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { createPauseMenu } from '../ui/pauseMenu';
import { createResultScreen } from '../ui/resultScreen';
import { createTitleScreen } from '../ui/titleScreen';
import { createBattleSession } from './battleSession';
import { loadSave, storeSave } from './save';

export function createApp(content: ContentDb, app: HTMLDivElement) {
  const screenRoot = app.querySelector<HTMLDivElement>('#screens');
  const stageDef = content.stages.get('stage-1');
  assert(screenRoot && stageDef, '시작 화면을 불러올 수 없습니다');
  const root = screenRoot;
  const stage = stageDef;
  const save = loadSave();
  let session: ReturnType<typeof createBattleSession> | undefined;
  let screen: { dispose(): void } | undefined;
  function clearScreen() {
    screen?.dispose();
    screen = undefined;
  }
  function setBattleVisible(visible: boolean) {
    for (const node of app.querySelectorAll<HTMLElement>('#board, #overlay, #hud')) node.hidden = !visible;
  }
  function showTitle() {
    clearScreen();
    session?.dispose();
    session = undefined;
    setBattleVisible(false);
    app.dataset.screen = 'title';
    screen = createTitleScreen(root, content, stage.name, save.stages[stage.id], startBattle);
  }
  function closePause(resume: boolean) {
    clearScreen();
    session?.setMenuOpen(false);
    session?.setPaused(!resume);
    app.dataset.screen = 'battle';
  }
  function showPause() {
    if (session?.battle.state.phase !== 'running') return;
    clearScreen();
    session.setMenuOpen(true);
    app.dataset.screen = 'paused';
    screen = createPauseMenu(root, {
      resume: () => closePause(true),
      deployPaused: () => closePause(false),
      restart: startBattle,
      exit: showTitle,
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
    clearScreen();
    session?.dispose();
    setBattleVisible(true);
    app.dataset.screen = 'battle';
    session = createBattleSession(content, app, {
      speed: save.settings.speed,
      onMenu: showPause,
      onEnd: showResult,
      onSpeed(speed) {
        save.settings.speed = speed;
        storeSave(save);
      },
    });
  }
  showTitle();
  return {
    dispose() {
      clearScreen();
      session?.dispose();
      setBattleVisible(false);
      delete app.dataset.screen;
    },
  };
}
