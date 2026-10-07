import { mountDialog } from './dialog';
import { button, element } from './dom';

export function createPauseMenu(
  root: HTMLElement,
  actions: { resume(): void; deployPaused(): void; restart(): void; exit(): void },
) {
  const dialog = element('dialog', 'game-dialog pause-menu');
  const heading = element('h2', '', '잠깐 쉬어가요');
  heading.id = 'dialog-title';
  const buttons = element('div', 'screen-actions');
  buttons.append(
    button('계속하기', actions.resume, 'primary-button'),
    button('멈춘 채 배치', actions.deployPaused),
    button('다시 시작', actions.restart),
    button('타이틀로', actions.exit),
  );
  dialog.append(
    heading,
    element('p', '', '전투가 멈췄어요. 친구들을 배치하고 이어서 지킬 수도 있어요.'),
    buttons,
  );
  return mountDialog(root, dialog, actions.resume);
}
