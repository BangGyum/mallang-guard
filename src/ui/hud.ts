import type { Battle } from '../sim/battle';
import { button, element } from './dom';

interface Controls {
  paused: boolean;
  speed: 1 | 2;
}
export function createHud(
  root: HTMLDivElement,
  battle: Battle,
  actions: { pause(): void; speed(): void; restart(): void },
) {
  const top = element('div', 'battle-top');
  const title = element('div', 'stage-title', '말랑방위대');
  title.append(element('small', '', battle.stage.definition.name));
  const stats = element('div', 'battle-stats');
  stats.setAttribute('aria-label', '전투 현황');
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
  const result = element('div', 'battle-result');
  result.hidden = true;
  const heading = element('strong', '');
  const detail = element('p', '');
  result.append(heading, detail, button('다시 하기', actions.restart));
  root.append(top, hint, toast, result);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
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
      stats.textContent = `♥ 푸딩 ${state.life}　 젤리 ${state.killed + state.leaked}/${state.totalEnemies}　 WAVE ${state.currentWave}/${state.totalWaves}`;
      pause.textContent = controls.paused ? '계속하기' : '일시정지';
      speed.textContent = `×${controls.speed}`;
      pause.disabled = state.phase !== 'running';
      speed.disabled = state.phase !== 'running';
      hint.hidden = state.tick > 150 || state.units.length > 0;
      result.hidden = state.phase === 'running';
      if (!result.hidden) {
        heading.textContent = state.phase === 'won' ? '방어 성공!' : '푸딩을 뺏겼어요…';
        detail.textContent = `푸딩 ${Math.max(0, state.life)}개 · 처치 ${state.killed}/${state.totalEnemies}`;
      }
    },
    dispose() {
      clearTimeout(timeoutId);
      top.remove();
      hint.remove();
      toast.remove();
      result.remove();
    },
  };
}
