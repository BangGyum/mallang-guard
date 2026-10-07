import { type PerspectiveCamera, Vector3 } from 'three';
import { assert } from '../core/assert';
import { lerp } from '../core/math';
import type { Board } from '../sim/board';
import type { BattleState } from '../sim/types';
import { tileHeight } from './coords';

export function createOverlay(canvas: HTMLCanvasElement, board: Board) {
  const context = canvas.getContext('2d');
  assert(context, '체력 표시 화면을 만들 수 없습니다');
  const ctx = context;
  const point = new Vector3();
  let width = 1;
  let height = 1;
  function bar(x: number, y: number, hp: number, maxHp: number, color: string) {
    ctx.fillStyle = 'rgba(36,28,48,.65)';
    ctx.beginPath();
    ctx.roundRect(x - 20, y + 6, 40, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - 19, y + 7, 38 * Math.max(0, hp / maxHp), 3, 1.5);
    ctx.fill();
  }
  function position(x: number, y: number, elevation: number, camera: PerspectiveCamera) {
    point.set(x - board.width / 2, elevation, y - board.height / 2).project(camera);
    return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height };
  }
  return {
    resize() {
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    render(state: Readonly<BattleState>, camera: PerspectiveCamera, alpha: number) {
      ctx.clearRect(0, 0, width, height);
      for (const unit of state.units) {
        const p = position(
          unit.tile.x + 0.5,
          unit.tile.y + 0.5,
          tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'ground'),
          camera,
        );
        bar(p.x, p.y, unit.hp, unit.maxHp, '#5BD17E');
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#446052';
        ctx.fillText({ right: '→', down: '↓', left: '←', up: '↑' }[unit.dir], p.x, p.y + 26);
      }
      for (const enemy of state.enemies)
        if (enemy.hp < enemy.maxHp) {
          const p = position(lerp(enemy.px, enemy.x, alpha), lerp(enemy.py, enemy.y, alpha), 0, camera);
          bar(p.x, p.y, enemy.hp, enemy.maxHp, '#FF5A6E');
        }
    },
    dispose() {
      ctx.clearRect(0, 0, width, height);
    },
  };
}
