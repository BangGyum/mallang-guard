import { ROLE_COLORS } from '../art/palette';
import type { ContentDb } from '../data/types';
import { button, element } from './dom';
import { portrait } from './portrait';

export function createTitleScreen(
  root: HTMLElement,
  content: ContentDb,
  stageName: string,
  record: { cleared: boolean; bestLife: number } | undefined,
  onStart: () => void,
  onSettings: () => void,
) {
  const screen = element('section', 'title-screen');
  screen.setAttribute('aria-label', '말랑방위대 시작 화면');
  const card = element('div', 'title-card');
  const intro = element('div', 'title-intro');
  intro.append(
    element('p', 'screen-eyebrow', '오늘도 푸딩을 지켜요'),
    element('h1', '', '말랑방위대'),
    element(
      'p',
      'title-description',
      '보라색 높은 칸에 동물 친구를 놓고, 각자의 스킬로 다가오는 젤리를 막아주세요.',
    ),
  );
  const stage = element('div', 'title-stage');
  stage.append(
    element('small', '', '오늘의 방어'),
    element('strong', '', stageName),
    element(
      'span',
      'title-record',
      record?.cleared ? `방어 성공 · 최고 푸딩 ${record.bestLife}개` : '친구들과 첫 방어를 시작해요',
    ),
  );
  const start = button('시작', onStart, 'primary-button start-button');
  intro.append(stage, start, element('p', 'title-controls', '드래그로 배치 · 친구를 눌러 스킬 사용'));
  start.after(button('설정', onSettings, 'title-settings'));
  const garden = element('div', 'title-garden');
  const pudding = portrait('pudding', 'title-pudding');
  pudding.setAttribute('aria-hidden', 'true');
  garden.append(pudding, element('p', '', '작은 친구들, 든든한 방위대'));
  const friends = element('div', 'title-friends');
  for (const [index, unit] of [...content.units.values()].entries()) {
    const friend = element('div', 'title-friend');
    friend.style.setProperty('--friend-color', ROLE_COLORS[unit.role]);
    friend.style.setProperty('--friend-delay', `${index * -0.18}s`);
    const icon = portrait(unit.art, '');
    icon.setAttribute('aria-hidden', 'true');
    friend.append(icon, element('small', '', unit.name));
    friends.append(friend);
  }
  garden.append(friends);
  card.append(intro, garden);
  screen.append(card, element('small', 'title-version', '말랑방위대 · v0.1'));
  root.append(screen);
  start.focus({ preventScroll: true });
  return { dispose: () => screen.remove() };
}
