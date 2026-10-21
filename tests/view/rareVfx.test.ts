import { InstancedMesh, Matrix4, PerspectiveCamera, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { hashState } from '../../src/sim/hash';
import { attackEnemies } from '../../src/sim/systems/attack';
import type { SimEvent } from '../../src/sim/types';
import { impactDelays } from '../../src/view/eventTiming';
import { createParticlePool } from '../../src/view/particlePool';
import { createVfx } from '../../src/view/vfx';
import { lineEnemy } from '../sim/lineSniperFixtures';
import { rareFixture } from '../sim/rareFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function fixture(id: string) {
  const f = rareFixture(id, true);
  f.state.enemies = [
    lineEnemy(10, 4),
    lineEnemy(11, 3),
    lineEnemy(12, 2),
    lineEnemy(13, 1),
    lineEnemy(14, 1, 1),
  ];
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
    (uid) => {
      const enemy = f.state.enemies.find((enemy) => enemy.uid === uid);
      return enemy ? new Vector3(enemy.x, 0.4, enemy.y) : undefined;
    },
    () => new Vector3(6.5, 1, 6.5),
  );
  const camera = new PerspectiveCamera();
  const events: SimEvent[] = [];
  attackEnemies(f.content, f.stage, f.state, events);
  const mesh = (id: string) => {
    const found = vfx.group.children.find(
      (node) => node instanceof InstancedMesh && node.material.uniforms.map?.value.name === id,
    );
    assert(found instanceof InstancedMesh, '이펙트 메시 없음');
    return found;
  };
  return {
    ...f,
    vfx,
    camera,
    events,
    mesh,
    dispose() {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

describe('희귀 무장과 연쇄 연결선', () => {
  it.each(['normal', 'reduced', 'low'])(
    '세라의 %s 불꽃은 착탄 전에 터지지 않고 연쇄 대상에서 함께 피어난다',
    (mode) => {
      const f = fixture('deer');
      try {
        f.vfx.setOptions(mode === 'reduced', mode === 'low');
        f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
        f.vfx.update(f.state, f.camera, 0.12);
        expect(f.mesh('flameBolt').count).toBe(1);
        expect(f.mesh('flameBloom').count).toBe(0);
        f.vfx.update(f.state, f.camera, 0.14);
        expect(f.mesh('flameLink').count).toBe(4);
        expect(f.mesh('flameBloom').count).toBe(mode === 'normal' ? 5 : 0);
        f.vfx.update(f.state, f.camera, 0.3);
        expect(f.mesh('flameBloom').count).toBe(0);
        expect(f.mesh('flameLink').count).toBe(0);
      } finally {
        f.dispose();
      }
    },
  );

  it.each([
    ['fox', 'chargedRail'],
    ['redPanda', 'shellRound'],
    ['deer', 'flameBolt'],
  ])('%s는 %s를 한 발 표시한다', (id, art) => {
    const f = fixture(id);
    try {
      const before = hashState(f.state);
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.03);
      // 강화 레일탄은 같은 메시의 짧은 총구 빛을 함께 표시합니다.
      expect(f.mesh(art).count).toBe(id === 'fox' ? 2 : 1);
      expect(hashState(f.state)).toBe(before);
    } finally {
      f.dispose();
    }
  });
  it.each(['normal', 'reduced', 'low'])(
    '%s에서 연쇄 연결은 도착 시 나타나고 정지/해제 규칙을 따른다',
    (mode) => {
      const f = fixture('deer');
      try {
        f.vfx.setOptions(mode === 'reduced', mode === 'low');
        f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
        f.vfx.update(f.state, f.camera, 0.24);
        expect(f.mesh('flameLink').count).toBe(0);
        f.vfx.update(f.state, f.camera, 0.02);
        const mesh = f.mesh('flameLink');
        expect(mesh.count).toBe(4);
        const matrix = new Matrix4();
        const centers = Array.from({ length: mesh.count }, (_, index) => {
          mesh.getMatrixAt(index, matrix);
          return new Vector3().setFromMatrixPosition(matrix).x;
        }).sort((a, b) => a - b);
        expect(centers).toEqual([7.5, 8, 9, 10]);
        const before = [...mesh.instanceMatrix.array];
        f.vfx.update(f.state, f.camera, 0);
        expect([...mesh.instanceMatrix.array]).toEqual(before);
        expect(f.vfx.count).toBeLessThanOrEqual(200);
        f.vfx.update(f.state, f.camera, 0.15);
        expect(mesh.count).toBe(0);
      } finally {
        f.dispose();
      }
    },
  );
  it.each([
    { label: '300ms', steps: [0.3] },
    { label: '150ms', steps: [0.15, 0.15] },
    { label: '100ms', steps: [0.1, 0.1, 0.1] },
    { label: '10ms', steps: Array.from({ length: 30 }, () => 0.01) },
  ])('$label 프레임에서도 도착 전 시간을 연쇄 수명에서 차감하지 않는다', ({ steps }) => {
    const f = fixture('deer');
    try {
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      for (const dt of steps) f.vfx.update(f.state, f.camera, dt);
      const mesh = f.mesh('flameLink');
      expect(mesh.count).toBe(4);
      expect(mesh.geometry.getAttribute('aOpacity').getX(0)).toBeCloseTo(0.75 * (1 - 0.05 / 0.14), 5);
      f.vfx.update(f.state, f.camera, 0.08);
      expect(mesh.count).toBe(4);
      f.vfx.update(f.state, f.camera, 0.02);
      expect(mesh.count).toBe(0);
    } finally {
      f.dispose();
    }
  });
  it.each(['fox', 'redPanda'])('%s의 명중 효과도 긴 프레임에서 생략되지 않는다', (id) => {
    const f = fixture(id);
    try {
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.3);
      const mesh = f.mesh(id === 'fox' ? 'skill-polarAim' : 'shellBurst');
      expect(mesh.count).toBe(id === 'fox' ? 3 : 1);
      expect(mesh.geometry.getAttribute('aOpacity').getX(0)).toBeCloseTo(
        0.85 * (1 - 0.05 / (id === 'fox' ? 0.18 : 0.32)),
        5,
      );
    } finally {
      f.dispose();
    }
  });
  it('연결선도 200개 풀 상한을 공유하고 재사용한 슬롯은 일반 투사체로 복원한다', () => {
    const texture = new Texture();
    const pool = createParticlePool(new Map(VFX_IDS.map((id) => [id, texture])));
    const camera = new PerspectiveCamera();
    try {
      for (let i = 0; i < 300; i++)
        pool.emit('flameLink', new Vector3(), new Vector3(2, 0, 0), 0.1, 0.3, 0, false, true, 0.75, true);
      pool.begin(0.03, camera);
      expect(pool.count).toBe(200);
      pool.begin(0.1, camera);
      pool.emit('arcBolt', new Vector3(), new Vector3(2, 0, 0), 1, 0.3);
      pool.begin(0.1, camera);
      expect(pool.count).toBe(1);
      const mesh = pool.group.children.find((node) => node instanceof InstancedMesh && node.count === 1);
      assert(mesh instanceof InstancedMesh, '재사용 투사체 없음');
      const matrix = new Matrix4();
      mesh.getMatrixAt(0, matrix);
      expect(new Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(0.288, 5);
    } finally {
      pool.dispose();
      texture.dispose();
    }
  });
});
