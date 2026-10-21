import { type PerspectiveCamera, Vector3 } from 'three';
import type { DamageType } from '../data/types';
import type { SimEvent } from '../sim/types';

export function createCombatText(ctx: CanvasRenderingContext2D) {
  const numbers = Array.from({ length: 64 }, () => ({
    active: false,
    age: 0,
    delay: 0,
    amount: 0,
    type: 'physical' as DamageType,
    position: new Vector3(),
  }));
  const projected = new Vector3();
  let leak = 0;
  return {
    onEvents(
      events: readonly SimEvent[],
      position: (uid: number) => Vector3 | undefined,
      delays: ReadonlyMap<SimEvent, number>,
    ) {
      for (const event of events) {
        if (event.type === 'enemyLeak') leak = 0.3;
        if (event.type !== 'damage') continue;
        const at = position(event.dst.uid);
        const number = numbers.find((number) => !number.active);
        if (!at || !number) continue;
        Object.assign(number, {
          active: true,
          age: 0,
          delay: delays.get(event) ?? 0,
          amount: Math.round(event.amount),
          type: event.damageType,
        });
        number.position.copy(at);
      }
    },
    render(camera: PerspectiveCamera, width: number, height: number, dt: number, reduced: boolean) {
      for (const number of numbers) {
        if (!number.active) continue;
        const elapsed = Math.max(0, dt - number.delay);
        number.delay = Math.max(0, number.delay - dt);
        if (number.delay > 0) continue;
        number.age += elapsed;
        if (number.age >= 0.6) {
          number.active = false;
          continue;
        }
        const progress = number.age / 0.6;
        projected.copy(number.position).project(camera);
        const x = ((projected.x + 1) / 2) * width;
        const y = ((1 - projected.y) / 2) * height - 10 - (reduced ? 0 : progress * 24);
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.font = `${height <= 500 ? 12 : 17}px Jua, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#44364d';
        ctx.strokeText(String(number.amount), x, y);
        ctx.fillStyle = number.type === 'magic' ? '#dbc3ff' : '#fffdf4';
        ctx.fillText(String(number.amount), x, y);
        ctx.restore();
      }
      leak = Math.max(0, leak - dt);
      if (leak > 0) {
        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2,
          height * 0.3,
          width / 2,
          height / 2,
          width * 0.7,
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, `rgba(240,91,117,${(leak / 0.3) * 0.3})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    },
  };
}
