import type { Battle } from '../sim/battle';
import { button, element } from './dom';
import { playFeedback } from './feedback';

interface Controls {
  paused: boolean;
  speed: 1 | 2;
}
export function createHud(root: HTMLDivElement, battle: Battle, actions: { pause(): void; speed(): void }) {
  const top = element('div', 'battle-top');
  const title = element('div', 'stage-title', '말랑방위대');
  title.append(element('small', '', battle.stage.definition.name));
  const stats = element('div', 'battle-stats');
  stats.setAttribute('aria-label', '전투 현황');
  const life = element('span', 'battle-life');
  const enemies = element('span', 'battle-enemies');
  const wave = element('span', 'battle-wave');
  stats.append(life, enemies, wave);
  const pause = button('일시정지', actions.pause);
  const speed = button('×1', actions.speed);
  pause.dataset.action = 'pause';
  speed.setAttribute('aria-label', '전투 배속 변경');
  top.append(title, stats, speed, pause);
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
      life.textContent = `♥ 푸딩 ${state.life}`;
      enemies.textContent = `젤리 ${state.killed + state.leaked}/${state.totalEnemies}`;
      wave.textContent = `WAVE ${state.currentWave}/${state.totalWaves}`;
      if (state.life < previousLife) playFeedback(life, 'shake');
      if (state.currentWave !== previousWave) playFeedback(wave, 'pulse');
      previousLife = state.life;
      previousWave = state.currentWave;
      life.classList.toggle('is-critical', state.life <= 1);
      pause.textContent = controls.paused ? '계속하기' : '일시정지';
      speed.textContent = `×${controls.speed}`;
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
