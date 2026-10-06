import { assert } from './core/assert';
import { parseBoard } from './sim/board';
import './ui/styles.css';
import { createBoardView } from './view/boardView';

async function main(): Promise<void> {
  // 모듈 초기화의 검증 오류도 이 Promise를 통해 화면에 표시한다.
  const { content } = await import('./data');
  const stage = content.stages.get('stage-1');
  assert(stage, 'content/stages: stage-1 missing');
  const host = document.getElementById('app');
  const canvas = document.getElementById('board');
  const overlay = document.getElementById('overlay');
  assert(host instanceof HTMLElement, 'app element missing');
  assert(canvas instanceof HTMLCanvasElement, 'board canvas missing');
  assert(overlay instanceof HTMLCanvasElement, 'overlay canvas missing');
  const view = createBoardView(parseBoard(stage.map), host, canvas, overlay);
  window.addEventListener('pagehide', view.dispose, { once: true });
  import.meta.hot?.dispose(view.dispose);
}

main().catch((error: unknown) => {
  const screens = document.getElementById('screens');
  assert(screens, 'screens element missing');
  const panel = document.createElement('section');
  panel.className = 'errorScreen';
  panel.setAttribute('role', 'alert');
  const heading = document.createElement('h1');
  heading.textContent = '게임을 불러오지 못했습니다';
  const message = document.createElement('pre');
  message.textContent = error instanceof Error ? error.message : String(error);
  panel.append(heading, message);
  screens.replaceChildren(panel);
  const hud = document.getElementById('hud');
  if (hud) hud.hidden = true;
});
