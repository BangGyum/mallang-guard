import stage from './data/stages/stage-1.json';
import { parseBoard } from './sim/board';
import './ui/styles.css';
import { createBoardView } from './view/boardView';

const canvas = document.querySelector<HTMLCanvasElement>('#board');
const app = document.querySelector<HTMLDivElement>('#app');
if (!canvas || !app) throw new Error('보드 화면 요소가 없습니다');

const view = createBoardView(canvas, parseBoard(stage.map));
const observer = new ResizeObserver(() => {
  view.resize();
  view.render();
});
observer.observe(app);
view.resize();
view.render();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    observer.disconnect();
    view.dispose();
  });
}
