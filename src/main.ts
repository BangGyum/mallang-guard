import { assert } from './core/assert';
import { parseBoard } from './sim/board';
import './ui/styles.css';
import { createBoardView } from './view/boardView';

let dispose: (() => void) | undefined;

async function boot(): Promise<void> {
  try {
    const { content } = await import('./data');
    const stage = content.stages.get('stage-1');
    assert(stage, 'stage-1 콘텐츠가 없습니다');
    const canvas = document.querySelector<HTMLCanvasElement>('#board');
    const app = document.querySelector<HTMLDivElement>('#app');
    assert(canvas && app, '보드 화면 요소가 없습니다');
    const view = createBoardView(canvas, parseBoard(stage.map));
    const observer = new ResizeObserver(() => {
      view.resize();
      view.render();
    });
    observer.observe(app);
    view.resize();
    view.render();
    dispose = () => {
      observer.disconnect();
      view.dispose();
    };
  } catch (error) {
    const message = document.createElement('div');
    message.className = 'load-error';
    message.setAttribute('role', 'alert');
    message.textContent = `게임을 불러오지 못했습니다.\n${error instanceof Error ? error.message : String(error)}`;
    document.querySelector('#screens')?.append(message);
  }
}

void boot();

if (import.meta.hot) {
  import.meta.hot.dispose(() => dispose?.());
}
