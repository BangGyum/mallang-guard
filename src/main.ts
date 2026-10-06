import { assert } from './core/assert';
import stage from './data/stages/stage-1.json';
import { parseBoard } from './sim/board';
import './ui/styles.css';
import { createBoardView } from './view/boardView';

const host = document.getElementById('app');
const canvas = document.getElementById('board');
const overlay = document.getElementById('overlay');
assert(host instanceof HTMLElement, 'app element missing');
assert(canvas instanceof HTMLCanvasElement, 'board canvas missing');
assert(overlay instanceof HTMLCanvasElement, 'overlay canvas missing');
const view = createBoardView(parseBoard(stage.map), host, canvas, overlay);
window.addEventListener('pagehide', view.dispose, { once: true });
import.meta.hot?.dispose(view.dispose);
