import { ROLE_COLORS, ROLE_NAMES } from '../art/palette';
import type { RecruitResult } from '../data/recruitment';
import type { ContentDb } from '../data/types';
import { mountDialog } from './dialog';
import { button, element } from './dom';
import { portrait } from './portrait';

export function createRecruitResult(
  root: HTMLElement,
  content: ContentDb,
  results: readonly RecruitResult[],
  cost: number,
  refund: number,
  close: () => void,
) {
  const dialog = element('dialog', 'game-dialog recruit-dialog');
  const heading = element('h2', '', '새로운 만남');
  heading.id = 'dialog-title';
  const summary = element(
    'p',
    'recruit-summary',
    `사용 ${cost.toLocaleString()}머니 · 중복 환급 ${refund.toLocaleString()}머니`,
  );
  const grid = element('div', 'recruit-results');
  for (const [index, result] of results.entries()) {
    const unit = content.units.get(result.unitId);
    if (!unit) continue;
    const card = element('article', 'recruit-result');
    card.dataset.unitId = unit.id;
    card.dataset.new = String(result.isNew);
    card.style.setProperty('--role-color', ROLE_COLORS[unit.role]);
    card.style.setProperty('--reveal-delay', `${index * 0.04}s`);
    card.append(
      element('span', 'recruit-result-badge', result.isNew ? '신규 영입' : '중복'),
      portrait(unit.art, 'recruit-result-portrait'),
      element('strong', '', unit.name),
      element('small', '', ROLE_NAMES[unit.role]),
      element(
        'span',
        'recruit-result-note',
        result.isNew ? '다음 전투부터 배치 가능' : `+${result.refund}머니 환급`,
      ),
    );
    if (result.guaranteed) card.append(element('small', 'recruit-guaranteed', '미보유 보장 적용'));
    grid.append(card);
  }
  const confirm = button('확인', close, 'primary-button recruit-confirm');
  dialog.append(heading, summary, grid, confirm);
  const mounted = mountDialog(root, dialog, close);
  confirm.focus({ preventScroll: true });
  return mounted;
}
