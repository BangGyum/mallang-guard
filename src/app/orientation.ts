import { element } from '../ui/dom';
import type { LoopControls } from './loop';

export function watchOrientation(app: HTMLDivElement, controls: LoopControls) {
  const guide = element('div', 'rotate-guide', '가로로 돌려주세요');
  guide.append(element('small', '', '친구들을 배치하기 좋게 화면을 넓혀주세요.'));
  guide.hidden = true;
  guide.setAttribute('role', 'status');
  app.append(guide);
  let rotating = false;
  let previouslyPaused = false;
  function update() {
    const portrait = navigator.maxTouchPoints > 0 && app.clientHeight > app.clientWidth;
    if (portrait && !rotating) {
      previouslyPaused = controls.paused;
      controls.paused = true;
    }
    if (!portrait && rotating) controls.paused = previouslyPaused;
    rotating = portrait;
    guide.hidden = !portrait;
  }
  const observer = new ResizeObserver(update);
  observer.observe(app);
  update();
  return {
    dispose() {
      observer.disconnect();
      guide.remove();
    },
  };
}
