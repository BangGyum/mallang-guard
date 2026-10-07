import { createBattleSession } from './app/battleSession';
import { assert } from './core/assert';
import './ui/styles.css';

let dispose: (() => void) | undefined;

async function boot(): Promise<void> {
  try {
    const { content } = await import('./data');
    const app = document.querySelector<HTMLDivElement>('#app');
    assert(app, '보드 화면 요소가 없습니다');
    const session = createBattleSession(content, app);
    dispose = () => session.dispose();
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
