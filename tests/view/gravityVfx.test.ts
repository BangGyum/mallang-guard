import { InstancedMesh, PerspectiveCamera, Texture, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { hashState } from '../../src/sim/hash';
import type { SimEvent } from '../../src/sim/types';
import { impactDelays } from '../../src/view/eventTiming';
import { createVfx } from '../../src/view/vfx';
import { rareFixture } from '../sim/rareFixtures';

afterEach(() => vi.unstubAllGlobals());
function fixture(quiet = false) {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  const f = rareFixture('snowLeopard');
  f.unit.skillState = 'active';
  f.unit.buffs = f.skill.effects;
  f.unit.gravityCenter = { x: 9.5, y: 6.5 };
  f.unit.skillEndTick = 120;
  const textures = new Map(
    VFX_IDS.map((id) => {
      const texture = new Texture();
      texture.name = id;
      return [id, texture] as const;
    }),
  );
  const vfx = createVfx(
    f.content,
    f.stage.board,
    textures,
    () => new Vector3(0, 1, 0),
    () => new Vector3(),
  );
  vfx.setOptions(quiet, false);
  const camera = new PerspectiveCamera();
  const mesh = (id: string) => {
    const found = vfx.group.children.find(
      (n) => n instanceof InstancedMesh && n.material.uniforms.map?.value.name === id,
    );
    assert(found instanceof InstancedMesh, '중력장 그림 없음');
    return found;
  };
  return {
    ...f,
    vfx,
    camera,
    mesh,
    dispose() {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

describe('노바 중력장 연출', () => {
  it('실제 범위는 고정하고 핵과 궤도만 수축·발광하며 정지하면 빛도 멈춘다', () => {
    const f = fixture();
    try {
      f.vfx.update(f.state, f.camera, 0.1);
      const core = f.mesh('gravityCore');
      const initialSize = core.instanceMatrix.array[0] ?? 0;
      const initialLight = core.geometry.getAttribute('aOpacity').getX(0);
      const ring = [...f.mesh('gravityRing').instanceMatrix.array];
      f.state.tick = 90;
      f.vfx.update(f.state, f.camera, 0.1);
      expect(core.instanceMatrix.array[0]).toBeLessThan(initialSize);
      expect(core.geometry.getAttribute('aOpacity').getX(0)).toBeGreaterThan(initialLight);
      expect([...f.mesh('gravityRing').instanceMatrix.array]).toEqual(ring);
      const stopped = [...core.instanceMatrix.array];
      f.vfx.update(f.state, f.camera, 0);
      expect([...core.instanceMatrix.array]).toEqual(stopped);
      f.state.units = [];
      f.vfx.update(f.state, f.camera, 0);
      expect(core.count).toBe(0);
    } finally {
      f.dispose();
    }
  });
  it.each([false, true])('모션 감소 %s에서 실제 중심·반경을 표시하고 정지·후퇴를 따른다', (quiet) => {
    const f = fixture(quiet);
    try {
      const before = hashState(f.state);
      f.vfx.update(f.state, f.camera, 0.1);
      const ring = f.mesh('gravityRing');
      expect(ring.count).toBe(1);
      expect(ring.instanceMatrix.array[12]).toBe(3);
      expect(ring.instanceMatrix.array[14]).toBe(0);
      expect(ring.instanceMatrix.array[0]).toBeCloseTo((3.6 * 64) / 58, 5);
      expect(f.mesh('gravityCore').count).toBe(quiet ? 0 : 3);
      const paused = [...ring.instanceMatrix.array];
      f.vfx.update(f.state, f.camera, 0);
      expect([...ring.instanceMatrix.array]).toEqual(paused);
      expect(hashState(f.state)).toBe(before);
      f.state.units = [];
      f.vfx.update(f.state, f.camera, 0);
      expect(ring.count).toBe(0);
    } finally {
      f.dispose();
    }
  });
  it.each([0.016, 0.25, 0.5])('%s초 긴 프레임에도 폭발을 첫 화면부터 표시하고 정리한다', (dt) => {
    const f = fixture();
    try {
      const event: SimEvent = {
        type: 'gravityField',
        uid: f.unit.uid,
        phase: 'burst',
        x: 9.5,
        y: 6.5,
        radius: 1.8,
      };
      f.state.units = [];
      f.vfx.onEvents([event], f.state, new Map());
      f.vfx.update(f.state, f.camera, dt);
      expect(f.mesh('gravityBurst').count).toBe(1);
      f.vfx.update(f.state, f.camera, 0);
      expect(f.mesh('gravityBurst').count).toBe(1);
      f.vfx.update(f.state, f.camera, 0.41);
      expect(f.mesh('gravityBurst').count).toBe(0);
      expect(f.vfx.count).toBe(0);
    } finally {
      f.dispose();
    }
  });
  it('일반 사격 뒤의 중력 폭발은 투사체 도착 지연을 물려받지 않는다', () => {
    const events: SimEvent[] = [
      {
        type: 'attack',
        src: { kind: 'unit', uid: 1 },
        dst: { kind: 'enemy', uid: 2 },
        damageType: 'magic',
        ranged: true,
      },
      {
        type: 'damage',
        src: { kind: 'unit', uid: 1 },
        dst: { kind: 'enemy', uid: 2 },
        damageType: 'magic',
        amount: 640,
      },
      { type: 'gravityField', uid: 1, phase: 'burst', x: 1, y: 1, radius: 1.8 },
      {
        type: 'damage',
        src: { kind: 'unit', uid: 1 },
        dst: { kind: 'enemy', uid: 2 },
        damageType: 'magic',
        amount: 1920,
      },
      { type: 'enemyDie', uid: 2 },
    ];
    const delays = impactDelays(events);
    assert(events[1] && events[3], '검사 사건 누락');
    expect(delays.get(events[1])).toBe(0.25);
    expect(delays.get(events[3])).toBeUndefined();
    assert(events[4], '사망 사건 누락');
    expect(delays.get(events[4])).toBeUndefined();
  });
});
