import type { Battle } from '../sim/battle';
import { battleIcon } from './battleIcon';
import { button, element } from './dom';
import { playFeedback } from './feedback';

interface Controls {
  paused: boolean;
  speed: 1 | 2;
  startInSec: number;
}
export function createHud(
  root: HTMLDivElement,
  battle: Battle,
  actions: { pause(): void; speed(): void; start(): void; exit(): void },
) {
  const top = element('div', 'battle-top');
  const title = element('div', 'stage-title', '말랑방위대');
  title.append(element('small', '', battle.stage.definition.name));
  const preparation = element('div', 'battle-preparation');
  const countdown = element('span', 'battle-countdown');
  countdown.setAttribute('role', 'timer');
  const start = button('3초 후 시작', actions.start, 'battle-start');
  start.dataset.action = 'start';
  preparation.append(start, countdown);
  const stats = element('div', 'battle-stats');
  stats.setAttribute('aria-label', '전투 현황');
  const life = element('span', 'battle-life');
  const enemies = element('span', 'battle-enemies');
  const wave = element('span', 'battle-wave');
  stats.append(life, enemies, wave);
  const pause = button('', actions.pause, 'battle-pause');
  const pauseLabel = element('span', '', '일시정지');
  const speed = button('', actions.speed, 'battle-speed');
  const speedLabel = element('span', '', '×1');
  const controls = element('div', 'battle-controls');
  speed.append(battleIcon('speed'), speedLabel);
  pause.append(battleIcon('pause'), pauseLabel);
  const exit = button('', actions.exit, 'battle-exit');
  exit.append(battleIcon('retreat'), element('span', '', '나가기'));
  exit.dataset.action = 'exit';
  exit.title = '전투를 종료하고 타이틀로 나가기';
  controls.append(speed, pause, exit);
  pause.dataset.action = 'pause';
  speed.setAttribute('aria-label', '전투 배속 변경');
  top.append(title, preparation, stats, controls);
  const hint = element(
    'p',
    'battle-hint',
    '친구를 보라색 고지대에 놓아주세요. 자동으로 공격하고, 친구를 누르면 스킬을 쓸 수 있어요.',
  );
  const toast = element('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  root.append(top, hint, toast);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let previousLife = battle.state.life;
  let previousWave = battle.state.currentWave;
  return {
    notify(message: string) {
      clearTimeout(timeoutId);
      toast.textContent = message;
      toast.hidden = false;
      timeoutId = setTimeout(() => {
        toast.hidden = true;
      }, 1500);
    },
    update(controls: Controls) {
      const state = battle.state;
      preparation.hidden = controls.startInSec <= 0;
      countdown.textContent = `시작까지 ${Math.ceil(controls.startInSec)}초`;
      start.disabled = controls.paused || controls.startInSec <= 3;
      life.textContent = `♥ 푸딩 ${state.life}`;
      enemies.textContent = `젤리 ${state.killed + state.leaked}/${state.totalEnemies}`;
      wave.textContent = `WAVE ${state.currentWave}/${state.totalWaves}`;
      if (state.life < previousLife) playFeedback(life, 'shake');
      if (state.currentWave !== previousWave) playFeedback(wave, 'pulse');
      previousLife = state.life;
      previousWave = state.currentWave;
      life.classList.toggle('is-critical', state.life <= 1);
      if (pause.dataset.paused !== String(controls.paused)) {
        pause.dataset.paused = String(controls.paused);
        pause.querySelector('.battle-icon')?.replaceWith(battleIcon(controls.paused ? 'play' : 'pause'));
      }
      pauseLabel.textContent = controls.paused ? '계속하기' : '일시정지';
      speedLabel.textContent = `×${controls.speed}`;
      pause.disabled = state.phase !== 'running';
      speed.disabled = state.phase !== 'running';
      hint.hidden = state.tick > 150 || state.units.length > 0;
    },
    dispose() {
      clearTimeout(timeoutId);
      top.remove();
      hint.remove();
      toast.remove();
    },
  };
}
