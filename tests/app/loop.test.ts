import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LoopControls, PREPARATION_SEC, startLoop } from '../../src/app/loop';
import { assert } from '../../src/core/assert';
import { createBattle } from '../../src/sim/battle';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, makeContent } from '../helpers';

afterEach(() => vi.unstubAllGlobals());

function fixture(startInSec = PREPARATION_SEC) {
  const events: SimEvent[] = [];
  const target = new EventTarget();
  const document = {
    hidden: false,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  let now = 0;
  let frame: FrameRequestCallback | undefined;
  let id = 0;
  const cancel = vi.fn();
  vi.stubGlobal('document', document);
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return ++id;
  });
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const stage = laneStage(
    ['S..........G', 'HHHHHHHHHHHH'],
    [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
  );
  const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
  const controls: LoopControls = { paused: false, speed: 1, bulletTime: false, startInSec };
  const render = vi.fn<(alpha: number, dt: number, wallDt: number) => void>();
  const loop = startLoop(battle, controls, (batch) => events.push(...batch), render);
  return {
    battle,
    controls,
    events,
    render,
    loop,
    cancel,
    visibility(hidden: boolean) {
      document.hidden = hidden;
      target.dispatchEvent(new Event('visibilitychange'));
    },
    at(ms: number) {
      now = ms;
      assert(frame, '예약된 프레임 없음');
      frame(ms);
    },
  };
}

describe('전투 시작 준비 시간', () => {
  it('10초 동안 배치만 적용하고 DP·SP·적·전투 틱을 멈춘다', () => {
    const f = fixture();
    f.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
    f.at(9000);
    expect(f.controls.startInSec).toBe(1);
    expect(f.battle.state.tick).toBe(0);
    expect(f.battle.state.dp).toBe(1);
    expect(f.battle.state.enemies).toEqual([]);
    const unit = f.battle.state.units[0];
    assert(unit, '준비 중 배치 실패');
    const initialSp = unit.sp;
    f.at(10000);
    expect(f.controls.startInSec).toBe(0);
    expect(f.battle.state.tick).toBe(0);
    expect(unit.sp).toBe(initialSp);
    f.at(10040);
    expect(f.battle.state.tick).toBe(1);
    expect(f.battle.state.enemies).toHaveLength(1);
    expect(unit.sp).toBeGreaterThan(initialSp);
    f.loop.dispose();
  });

  it('배속·선택 슬로모션과 프레임 지연이 준비 시간을 늘리거나 줄이지 않는다', () => {
    const f = fixture();
    f.controls.speed = 2;
    f.controls.bulletTime = true;
    f.at(8000);
    expect(f.controls.startInSec).toBe(2);
    expect(f.battle.state.tick).toBe(0);
    f.at(10000);
    expect(f.controls.startInSec).toBe(0);
    expect(f.battle.state.tick).toBe(0);
    f.loop.dispose();
  });

  it('일시정지 중에는 준비 시간도 멈추고 후퇴 명령은 적용한다', () => {
    const f = fixture();
    f.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
    f.at(1000);
    const uid = f.battle.state.units[0]?.uid ?? -1;
    f.controls.paused = true;
    f.battle.enqueue({ type: 'retreat', uid });
    f.at(6000);
    expect(f.controls.startInSec).toBe(9);
    expect(f.battle.state.units).toEqual([]);
    expect(f.events.some((event) => event.type === 'unitRetreat')).toBe(true);
    expect(f.render.mock.lastCall?.[1]).toBe(0);
    f.controls.paused = false;
    f.at(7000);
    expect(f.controls.startInSec).toBe(8);
    expect(f.battle.state.tick).toBe(0);
    f.loop.dispose();
  });

  it('준비가 끝난 프레임은 경계 이후 시간만 시뮬레이션에 전달한다', () => {
    const f = fixture(0.05);
    f.at(100);
    expect(f.controls.startInSec).toBe(0);
    expect(f.battle.state.tick).toBe(1);
    expect(f.render.mock.lastCall?.[0]).toBeCloseTo(0.5);
    f.loop.dispose();
  });

  it('준비가 끝나면 기존 30Hz 전투와 정지 동작을 유지한다', () => {
    const f = fixture(0);
    f.at(100);
    expect(f.battle.state.tick).toBe(3);
    f.controls.paused = true;
    f.at(200);
    expect(f.battle.state.tick).toBe(3);
    f.loop.dispose();
  });

  it('숨긴 탭에서는 준비 시간을 멈추고 재개 후 남은 시간을 센다', () => {
    const f = fixture();
    f.at(1000);
    f.visibility(true);
    f.at(5000);
    expect(f.controls.paused).toBe(true);
    expect(f.controls.startInSec).toBe(9);
    f.visibility(false);
    f.controls.paused = false;
    f.at(6000);
    expect(f.controls.startInSec).toBe(8);
    f.loop.dispose();
  });

  it('종료 시 예약 프레임과 가시성 리스너를 정리한다', () => {
    const f = fixture();
    f.loop.dispose();
    expect(f.cancel).toHaveBeenCalledWith(1);
    f.visibility(true);
    expect(f.controls.paused).toBe(false);
  });
});
