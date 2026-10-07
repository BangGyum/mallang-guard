import { mountDialog } from './dialog';
import { button, element } from './dom';

export function createResultScreen(
  root: HTMLElement,
  result: { won: boolean; life: number; killed: number; totalEnemies: number; bestLife: number },
  actions: { restart(): void; exit(): void },
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
  buttons.append(button('다시 하기', actions.restart, 'primary-button'), button('타이틀로', actions.exit));
  dialog.append(icon, heading, detail, encouragement, best, buttons);
  return mountDialog(root, dialog, () => {});
}
