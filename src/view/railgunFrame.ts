import { clamp } from '../core/math';
import type { BattleState, SimEvent } from '../sim/types';

function smooth(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function createRailgunFrame(ctx: CanvasRenderingContext2D) {
  const active = new Set<number>();
  let visible = false;
  let age = 0;
  let shotAge = 1;
  let shotPending = false;
  let release = 0;
  let size = '';
  let washes: { gradient: CanvasGradient; rect: readonly [number, number, number, number] }[] = [];

  function reset() {
    active.clear();
    visible = false;
    age = release = 0;
    shotAge = 1;
    shotPending = false;
  }

  function glow(width: number, height: number, band: number) {
    const key = `${width}:${height}`;
    if (size === key) return;
    size = key;
    washes = (
      [
        { axis: [0, 0, band, 0], rect: [0, 0, band, height] },
        { axis: [width, 0, width - band, 0], rect: [width - band, 0, band, height] },
        { axis: [0, 0, 0, band], rect: [0, 0, width, band] },
        { axis: [0, height, 0, height - band], rect: [0, height - band, width, band] },
      ] as const
    ).map(({ axis: [x0, y0, x1, y1], rect }) => {
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, 'rgba(53,230,194,.38)');
      gradient.addColorStop(0.35, 'rgba(53,230,194,.12)');
      gradient.addColorStop(1, 'rgba(53,230,194,0)');
      return { gradient, rect };
    });
  }

  return {
    onEvents(events: readonly SimEvent[]) {
      for (const event of events) {
        if (event.type === 'skillStart' && event.skillId === 'polarAim' && !active.has(event.uid)) {
          active.add(event.uid);
          visible = true;
          age = release = 0;
          shotAge = 1;
          shotPending = false;
        }
        if (event.type === 'attack' && event.src.kind === 'unit' && active.has(event.src.uid))
          shotPending = true;
        if (event.type === 'skillEnd') active.delete(event.uid);
        if (event.type === 'unitRetreat' && active.delete(event.uid) && active.size === 0) reset();
        if (event.type === 'battleEnd') reset();
      }
    },
    render(state: Readonly<BattleState>, width: number, height: number, dt: number, quiet: boolean) {
      if (!visible) return;
      if (state.phase !== 'running') {
        reset();
        return;
      }
      for (const uid of active)
        if (!state.units.some((unit) => unit.uid === uid && unit.skillState === 'active')) active.delete(uid);
      age += dt;
      // 이번 프레임의 사격을 그리기 전에 이전 프레임 간격으로 소멸시키지 않습니다.
      shotAge = shotPending ? 0 : shotAge + dt;
      shotPending = false;
      release = active.size ? 0 : release + dt;
      if (release >= 0.28) {
        reset();
        return;
      }
      const band = Math.min(42, Math.max(16, height * 0.04));
      const length = Math.min(110, Math.max(44, height * 0.12), width / 4);
      const charge = smooth(age / 0.12);
      const opacity =
        (quiet
          ? 0.48
          : 0.25 +
            charge * (0.4 + (1 - smooth((age - 0.12) / 0.53)) * 0.3) +
            (1 - smooth(shotAge / 0.2)) * 0.2) *
        (1 - smooth(release / 0.28));
      ctx.save();
      ctx.globalAlpha = Math.min(1, opacity);
      if (!quiet) {
        glow(width, height, band);
        for (const wash of washes) {
          ctx.fillStyle = wash.gradient;
          ctx.fillRect(...wash.rect);
        }
        ctx.strokeStyle = '#50dfc8';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 18, 2, 18]);
        ctx.lineDashOffset = -age * 42;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        ctx.setLineDash([]);
      }
      for (const [x, y, flipX, flipY] of [
        [0, 0, 1, 1],
        [width, 0, -1, 1],
        [0, height, 1, -1],
        [width, height, -1, -1],
      ] as const) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flipX, flipY);
        ctx.beginPath();
        ctx.moveTo(9, length);
        ctx.lineTo(9, 24);
        ctx.lineTo(24, 9);
        ctx.lineTo(length, 9);
        ctx.strokeStyle = '#164e50';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = '#a5fff0';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(16, length * 0.7);
        ctx.lineTo(16, 29);
        ctx.lineTo(29, 16);
        ctx.lineTo(length * 0.7, 16);
        ctx.strokeStyle = '#48cdb8';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (!quiet) {
          const phase = (age * 0.45) % 1;
          const travel = phase * (length - 36);
          ctx.globalAlpha = Math.min(1, opacity) * Math.sin(Math.PI * phase) ** 2;
          ctx.fillStyle = '#d9fff8';
          ctx.fillRect(28 + travel, 7, 8, 4);
          ctx.fillRect(7, 28 + travel, 4, 8);
          ctx.beginPath();
          ctx.moveTo(4, 33);
          ctx.lineTo(7, 28);
          ctx.lineTo(4, 23);
          ctx.lineTo(10, 16);
          ctx.lineTo(15, 13);
          ctx.strokeStyle = '#9bffee';
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    },
    dispose() {
      reset();
      washes = [];
      size = '';
    },
  };
}
