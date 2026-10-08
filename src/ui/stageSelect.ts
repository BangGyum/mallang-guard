import { type StageRecord, stageUnlocked, starCount } from '../data/progression';
import type { ContentDb } from '../data/types';
import { button, element } from './dom';
import { portrait } from './portrait';

export function createStageSelect(
  root: HTMLElement,
  content: ContentDb,
  records: Readonly<Record<string, StageRecord>>,
  selectedId: string,
  actions: { start(id: string): void; back(): void },
) {
  const screen = element('section', 'stage-screen');
  screen.setAttribute('aria-label', '스테이지 선택');
  const shell = element('div', 'stage-shell');
  const header = element('header', 'stage-header');
  header.append(element('h1', '', '푸딩을 지킬 곳'), button('타이틀로', actions.back));
  const hint = element('p', 'stage-hint', '방어에 성공하면 다음 정원이 열려요. 푸딩을 셋 다 지키면 별 셋!');
  const grid = element('div', 'stage-grid');
  const stages = [...content.stages.values()];
  for (const [index, stage] of stages.entries()) {
    const card = button('', () => actions.start(stage.id), 'stage-card');
    card.dataset.stageId = stage.id;
    card.disabled = !stageUnlocked(stages, records, index);
    card.classList.toggle('is-current', stage.id === selectedId);
    const stars = starCount(records[stage.id]);
    const rating = element('span', 'stage-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars));
    rating.setAttribute('aria-label', `최고 별 ${stars}개`);
    const map = element('span', 'stage-map');
    map.setAttribute('aria-hidden', 'true');
    map.style.gridTemplateColumns = `repeat(${stage.map[0]?.length ?? 1}, 1fr)`;
    for (const row of stage.map)
      for (const tile of row) {
        const cell = element('span', '');
        cell.dataset.tile = tile;
        map.append(cell);
      }
    const foes = element('span', 'stage-enemies');
    const enemyIds = new Set(stage.spawns.map((spawn) => spawn.enemy));
    for (const id of [...enemyIds]) {
      const split = content.enemies.get(id)?.split;
      if (split) enemyIds.add(split.enemy);
    }
    for (const id of enemyIds) {
      const enemy = content.enemies.get(id);
      if (!enemy) continue;
      const foe = element('span', 'stage-enemy');
      foe.title = enemy.description ?? enemy.name;
      foe.append(portrait(enemy.art, ''), element('small', '', enemy.name));
      foes.append(foe);
    }
    card.append(
      element('strong', 'stage-name', stage.name),
      rating,
      map,
      element('span', 'stage-description', stage.description ?? '보라색 높은 칸에 친구를 배치해요.'),
      foes,
      element(
        'span',
        'stage-state',
        card.disabled
          ? '앞 스테이지를 클리어하면 열려요'
          : records[stage.id]?.cleared
            ? '다시 방어하기'
            : '방어 시작',
      ),
    );
    grid.append(card);
  }
  shell.append(header, hint, grid);
  screen.append(shell);
  root.append(screen);
  header.querySelector('button')?.focus({ preventScroll: true });
  return { dispose: () => screen.remove() };
}
