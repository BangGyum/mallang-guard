import { describe, expect, it, vi } from 'vitest';
import { hashState } from '../../src/sim/hash';
import type { SimEvent } from '../../src/sim/types';
import { createRailgunFrame } from '../../src/view/railgunFrame';
import { rareFixture } from '../sim/rareFixtures';

function fixture() {
  const f = rareFixture('fox', true);
  const strokes: number[] = [];
  const fills: number[] = [];
  const ctx = {
    globalAlpha: 1,
    lineDashOffset: 0,
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn<(x: number, y: number, width: number, height: number) => void>(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke() {
      strokes.push(ctx.globalAlpha);
    },
  };
  ctx.fillRect.mockImplementation(() => {
    fills.push(ctx.globalAlpha);
  });
  const frame = createRailgunFrame(ctx as unknown as CanvasRenderingContext2D);
  const start: SimEvent = { type: 'skillStart', uid: f.unit.uid, skillId: 'polarAim' };
  const attack: SimEvent = {
    type: 'attack',
    src: { kind: 'unit', uid: f.unit.uid },
    dst: { kind: 'enemy', uid: 999 },
    damageType: 'physical',
    ranged: true,
  };
  return {
    ...f,
    frame,
    ctx,
    strokes,
    fills,
    start,
    attack,
    render(dt = 0, quiet = false) {
      strokes.length = 0;
      frame.render(f.state, 1920, 1080, dt, quiet);
      return strokes[0];
    },
  };
}

describe('루아 레일건 화면 테두리', () => {
  it('다른 스킬·일반 사격에는 표시하지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([{ ...f.start, skillId: 'tripleAim' }, f.attack]);
    expect(f.render(1)).toBeUndefined();
    expect(f.ctx.fillRect).not.toHaveBeenCalled();
  });

  it('발동 시 네 귀퉁이를 표시하고 중앙을 채우지 않는다', () => {
    const f = fixture();
    const before = hashState(f.state);
    f.frame.onEvents([f.start]);
    expect(f.render(0.08)).toBeGreaterThan(0);
    expect(f.ctx.translate).toHaveBeenCalledTimes(4);
    for (const [x, y, width, height] of f.ctx.fillRect.mock.calls)
      expect(x + width <= 42 || y + height <= 42 || x >= 1878 || y >= 1038).toBe(true);
    expect(hashState(f.state)).toBe(before);
  });

  it('일시정지 중 밝기와 전류 위치를 고정하고 그라디언트를 재사용한다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const alpha = f.render(0.21);
    const offset = f.ctx.lineDashOffset;
    const calls = f.ctx.fillRect.mock.calls.slice(-8);
    expect(f.render(0)).toBe(alpha);
    expect(f.ctx.lineDashOffset).toBe(offset);
    expect(f.ctx.fillRect.mock.calls.slice(-8)).toEqual(calls);
    expect(f.ctx.createLinearGradient).toHaveBeenCalledTimes(4);
  });

  it('모션 감소·낮은 품질은 움직임과 사격 점등 없는 정적 테두리다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const alpha = f.render(0.1, true);
    f.frame.onEvents([f.attack]);
    expect(f.render(5, true)).toBe(alpha);
    expect(f.ctx.fillRect).not.toHaveBeenCalled();
    expect(f.ctx.setLineDash).not.toHaveBeenCalled();
    expect(alpha).toBeLessThan(0.5);
  });

  it('동일 발동 중복은 전류를 재시작하지 않고 루아의 사격만 밝기를 더한다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const steady = f.render(1);
    const offset = f.ctx.lineDashOffset;
    f.frame.onEvents([f.start, { ...f.attack, src: { kind: 'unit', uid: 999 } }]);
    expect(f.render()).toBe(steady);
    expect(f.ctx.lineDashOffset).toBe(offset);
    f.frame.onEvents([f.attack, f.attack]);
    expect(f.render()).toBeGreaterThan(steady ?? 0);
  });

  it.each(['event', 'state'] as const)('%s 만료를 감지해 짧게 사라진다', (mode) => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const steady = f.render(1);
    if (mode === 'event') f.frame.onEvents([{ type: 'skillEnd', uid: f.unit.uid }]);
    else f.unit.skillState = 'charging';
    const tail = f.render(0.14);
    expect(tail).toBeGreaterThan(0);
    expect(tail).toBeLessThan(steady ?? 0);
    expect(f.render(0.15)).toBeUndefined();
    expect(f.render()).toBeUndefined();
  });

  it('후퇴·재배치에는 이전 테두리가 남지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    f.render(1);
    f.frame.onEvents([{ type: 'unitRetreat', uid: f.unit.uid, refund: 0 }]);
    expect(f.render(0.3)).toBeUndefined();
    f.frame.onEvents([f.attack]);
    expect(f.render()).toBeUndefined();
    f.frame.onEvents([f.start]);
    expect(f.render(0.08)).toBeGreaterThan(0);
  });

  it.each(['event', 'state', 'dispose'] as const)('%s 종료 즉시 정리한다', (mode) => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    f.render(0.08);
    if (mode === 'event') f.frame.onEvents([{ type: 'battleEnd', result: 'won' }]);
    else if (mode === 'state') f.state.phase = 'lost';
    else f.frame.dispose();
    expect(f.render()).toBeUndefined();
  });

  it('정지 중 루아를 후퇴시켜도 테두리가 남지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    f.render(1);
    f.frame.onEvents([{ type: 'unitRetreat', uid: f.unit.uid, refund: 0 }]);
    expect(f.render(0)).toBeUndefined();
  });

  it.each([0.25, 0.5])('%s초 프레임에도 새 사격 반응을 한 번 표시하고 사라진다', (dt) => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const steady = f.render(1);
    f.frame.onEvents([f.attack]);
    expect(f.render(dt)).toBeGreaterThan(steady ?? 0);
    expect(f.render(0.21)).toBe(steady);
  });

  it('전류 조각이 시작점으로 돌아갈 때 옅어져 위치가 튀지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    f.render(1 / 0.45 - 0.002);
    expect(Math.max(...f.fills.slice(-8))).toBeLessThan(0.02);
    f.render(0.004);
    expect(Math.max(...f.fills.slice(-8))).toBeLessThan(0.02);
  });

  it('발동 밝기가 짧게 차오른 뒤 안정되며 정지 시간에는 진행되지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const start = f.render();
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(0.4);
    expect(f.render()).toBe(start);
    const peak = f.render(0.12);
    expect(peak).toBeGreaterThan(start ?? 0);
    const steady = f.render(0.54);
    expect(steady).toBeGreaterThan(start ?? 0);
    expect(steady).toBeLessThan(peak ?? 0);
  });

  it('다른 유닛의 후퇴는 루아의 테두리를 지우지 않는다', () => {
    const f = fixture();
    f.frame.onEvents([f.start]);
    const steady = f.render(1);
    f.frame.onEvents([{ type: 'unitRetreat', uid: 999, refund: 0 }]);
    expect(f.render()).toBe(steady);
  });
});
