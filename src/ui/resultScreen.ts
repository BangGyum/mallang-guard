import { mountDialog } from './dialog';
import { button, element } from './dom';

export function createResultScreen(
  root: HTMLElement,
  result: {
    won: boolean;
    life: number;
    killed: number;
    totalEnemies: number;
    bestLife: number;
    stars: number;
  },
  actions: { restart(): void; exit(): void; stages(): void; next?: () => void },
) {
  const dialog = element('dialog', 'game-dialog battle-result');
  dialog.dataset.result = result.won ? 'won' : 'lost';
  const icon = element('div', 'result-icon', result.won ? '🍮' : '🌱');
  icon.setAttribute('aria-hidden', 'true');
  const heading = element('h2', '', result.won ? '방어 성공!' : '푸딩을 뺏겼어요…');
  heading.id = 'dialog-title';
  const detail = element(
    'p',
    'result-detail',
    `푸딩 ${Math.max(0, result.life)}개 · 처치 ${result.killed}/${result.totalEnemies}`,
  );
  const encouragement = element(
    'p',
    'result-message',
    result.won ? '친구들과 푸딩을 무사히 지켰어요!' : '친구를 조금 더 일찍 배치해 볼까요?',
  );
  const best = element(
    'span',
    'result-best',
    result.bestLife > 0 ? `최고 기록 · 푸딩 ${result.bestLife}개` : '보라색 높은 칸에 친구들을 놓아주세요.',
  );
  const buttons = element('div', 'screen-actions');
  if (actions.next) buttons.append(button('다음 스테이지', actions.next, 'primary-button'));
  buttons.append(button('다시 하기', actions.restart, 'primary-button'), button('타이틀로', actions.exit));
  buttons.append(button('스테이지 선택', actions.stages));
  const stars = element('div', 'result-stars', '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars));
  stars.setAttribute('aria-label', `별 ${result.stars}개`);
  stars.hidden = !result.won;
  dialog.append(icon, heading, stars, detail, encouragement, best, buttons);
  return mountDialog(root, dialog, () => {});
}
