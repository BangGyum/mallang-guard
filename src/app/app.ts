import { unitAttackSound } from '../audio/combatSounds';
import { createSfx } from '../audio/sfx';
import { assert } from '../core/assert';
import { starCount } from '../data/progression';
import { type MoneyReward, recruitment } from '../data/recruitment';
import type { ContentDb } from '../data/types';
import { createPauseMenu } from '../ui/pauseMenu';
import { createResultScreen } from '../ui/resultScreen';
import { createSettings } from '../ui/settings';
import { createShopScreen } from '../ui/shopScreen';
import { createStageSelect } from '../ui/stageSelect';
import { createTitleScreen } from '../ui/titleScreen';
import { impactDelays } from '../view/eventTiming';
import { createBattleSession } from './battleSession';
import { battleMoney, buyUnit, commitCollection, ownedBattleContent, recruitUnits } from './collection';
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
  let stage = stageDef;
  const stages = [...content.stages.values()];
  const save = loadSave(content.unitOrder, crypto.getRandomValues(new Uint32Array(1))[0]);
  storeSave(save);
  const sound = createSfx(save.settings.sfxVolume);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let automaticQuality = true;
  let session: ReturnType<typeof createBattleSession> | undefined;
  let screen: { dispose(): void } | undefined;
  let moneyReward: MoneyReward | undefined;
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
    screen = createTitleScreen(
      root,
      content,
      stage.name,
      save.stages[stage.id],
      startBattle,
      showSettings,
      showStages,
      { money: save.collection.money, ownedUnits: save.collection.ownedUnits, shop: showShop },
    );
  }
  function showShop() {
    const fromResult = !!session && session.battle.state.phase !== 'running';
    sound.reset();
    clearScreen();
    if (!fromResult) {
      session?.dispose();
      session = undefined;
    }
    setBattleVisible(false);
    app.dataset.screen = 'shop';
    screen = createShopScreen(root, content, () => save.collection, {
      backLabel: fromResult ? '전투 결과로' : '타이틀로',
      back() {
        if (fromResult) {
          setBattleVisible(true);
          session?.refresh();
          showResult();
        } else showTitle();
      },
      draw(count) {
        const result = commitCollection(save, recruitUnits(save.collection, count, content.unitOrder));
        if (result.ok && moneyReward) moneyReward.saved = true;
        if (result.ok) sound.play('deploy');
        return result;
      },
      buy(id) {
        const result = commitCollection(save, buyUnit(save.collection, id, content.unitOrder));
        if (result.ok && moneyReward) moneyReward.saved = true;
        if (result.ok) sound.play('deploy');
        return result;
      },
    });
  }
  function showStages() {
    sound.reset();
    clearScreen();
    session?.dispose();
    session = undefined;
    setBattleVisible(false);
    app.dataset.screen = 'stages';
    screen = createStageSelect(root, content, save.stages, stage.id, {
      back: showTitle,
      start(id) {
        const selected = content.stages.get(id);
        assert(selected, '선택한 스테이지가 없습니다');
        stage = selected;
        startBattle();
      },
    });
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
    if (state.phase === 'running') return;
    const won = state.phase === 'won';
    if (!moneyReward) {
      const firstClear = won && !save.stages[stage.id]?.cleared;
      const reward = battleMoney(
        stage.id,
        won,
        state.killed,
        starCount({ cleared: won, bestLife: state.life }),
        firstClear,
      );
      const amount = Math.min(reward, recruitment.maxMoney - save.collection.money);
      save.collection.money += amount;
      if (won)
        save.stages[stage.id] = {
          cleared: true,
          bestLife: Math.max(save.stages[stage.id]?.bestLife ?? 0, state.life),
        };
      moneyReward = { amount, balance: save.collection.money, firstClear, saved: storeSave(save) };
    }
    clearScreen();
    session.setMenuOpen(true);
    app.dataset.screen = 'result';
    const next = won ? stages[stages.indexOf(stage) + 1] : undefined;
    screen = createResultScreen(
      root,
      {
        won,
        life: state.life,
        killed: state.killed,
        totalEnemies: state.totalEnemies,
        bestLife: save.stages[stage.id]?.bestLife ?? 0,
        stars: starCount({ cleared: won, bestLife: state.life }),
        reward: { ...moneyReward, balance: save.collection.money },
      },
      {
        restart: startBattle,
        exit: showTitle,
        stages: showStages,
        shop: showShop,
        ...(next
          ? {
              next() {
                stage = next;
                startBattle();
              },
            }
          : {}),
      },
    );
  }
  function startBattle() {
    sound.reset();
    clearScreen();
    session?.dispose();
    moneyReward = undefined;
    setBattleVisible(true);
    app.dataset.screen = 'battle';
    app.dataset.stageId = stage.id;
    session = createBattleSession(
      ownedBattleContent(content, stage.id, save.collection.ownedUnits),
      app,
      {
        speed: save.settings.speed,
        stageId: stage.id,
        options: viewOptions(),
        automaticQuality,
        onMenu: showPause,
        onExit: showTitle,
        onEnd: showResult,
        onEvents(events) {
          sound.onEvents(events, impactDelays(events), (uid) => {
            const unit = session?.battle.state.units.find((unit) => unit.uid === uid);
            const definition = unit && content.units.get(unit.unitId);
            return definition && unitAttackSound(definition.art);
          });
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
      delete app.dataset.stageId;
      delete app.dataset.reducedMotion;
    },
  };
}
