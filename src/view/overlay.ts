import { type PerspectiveCamera, Vector3 } from 'three';
import { assert } from '../core/assert';
import { lerp } from '../core/math';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import { TICK_RATE } from '../sim/constants';
import type { BattleState, SimEvent } from '../sim/types';
import { createCombatText } from './combatText';
import { tileHeight } from './coords';
import { impactDelays } from './eventTiming';

export function createOverlay(canvas: HTMLCanvasElement, board: Board, content: ContentDb) {
  const context = canvas.getContext('2d');
  assert(context, '게이지 표시 화면을 만들 수 없습니다');
  const ctx = context;
  const point = new Vector3();
  const combatText = createCombatText(ctx);
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = 0;
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
    setReducedMotion(value: boolean) {
      reduced = value;
    },
    onEvents(events: readonly SimEvent[], entityPosition: (uid: number) => Vector3 | undefined) {
      combatText.onEvents(events, entityPosition, impactDelays(events));
    },
    resize() {
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    render(state: Readonly<BattleState>, camera: PerspectiveCamera, alpha: number, dt = 0) {
      time += dt;
      ctx.clearRect(0, 0, width, height);
      for (const unit of state.units) {
        const p = position(
          unit.tile.x + 0.5,
          unit.tile.y + 0.5,
          tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'ground'),
          camera,
        );
        const def = content.units.get(unit.unitId);
        const skill = def && content.skills.get(def.skill);
        assert(skill, '스킬 정보가 없습니다');
        const active = unit.skillState === 'active';
        const ready = unit.skillState === 'ready';
        bar(
          p.x,
          p.y,
          active ? Math.max(0, unit.skillEndTick - state.tick) / TICK_RATE : unit.sp,
          active ? skill.durationSec : skill.spCost,
          active ? '#eea54b' : ready ? '#f1c743' : '#759bdb',
        );
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#446052';
        ctx.fillText(
          `${{ right: '→', down: '↓', left: '←', up: '↑' }[unit.dir]} ${active ? '스킬 중' : ready ? '준비!' : 'SP'}`,
          p.x,
          p.y + 26,
        );
        if (ready && skill.trigger === 'manual') {
          const head = position(unit.tile.x + 0.5, unit.tile.y + 0.5, 1.3, camera);
          const y = head.y - (reduced ? 0 : Math.sin(time * 3 + unit.uid) * 2);
          ctx.fillStyle = '#ffe494';
          ctx.beginPath();
          ctx.roundRect(head.x - 22, y - 13, 44, 19, 7);
          ctx.fill();
          ctx.fillStyle = '#70522d';
          ctx.font = '12px Jua, sans-serif';
          ctx.fillText('스킬!', head.x, y + 1);
        }
      }
      for (const enemy of state.enemies) {
        if (enemy.hp < enemy.maxHp) {
          const p = position(lerp(enemy.px, enemy.x, alpha), lerp(enemy.py, enemy.y, alpha), 0, camera);
          bar(p.x, p.y, enemy.hp, enemy.maxHp, '#FF5A6E');
        }
        if (enemy.slowAmount > 0 || enemy.stunUntilTick > state.tick) {
          const p = position(enemy.x, enemy.y, 0, camera);
          ctx.font = '11px Jua, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#725096';
          ctx.fillText(enemy.stunUntilTick > state.tick ? '기절' : '느림', p.x, p.y + 24);
        }
      }
      combatText.render(camera, width, height, dt, reduced);
    },
    dispose() {
      ctx.clearRect(0, 0, width, height);
    },
  };
}
