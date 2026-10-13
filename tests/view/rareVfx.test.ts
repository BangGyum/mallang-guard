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
  it.each([
    ['fox', 'mintRailRound'],
    ['redPanda', 'shellRound'],
    ['deer', 'arcBolt'],
  ])('%s는 %s를 한 발 표시한다', (id, art) => {
    const f = fixture(id);
    try {
      const before = hashState(f.state);
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.03);
      expect(f.mesh(art).count).toBe(1);
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
        expect(f.mesh('lightningLink').count).toBe(0);
        f.vfx.update(f.state, f.camera, 0.02);
        const mesh = f.mesh('lightningLink');
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
  it('연결선도 200개 풀 상한을 공유하고 재사용한 슬롯은 일반 투사체로 복원한다', () => {
    const texture = new Texture();
    const pool = createParticlePool(new Map(VFX_IDS.map((id) => [id, texture])));
    const camera = new PerspectiveCamera();
    try {
      for (let i = 0; i < 300; i++)
        pool.emit('lightningLink', new Vector3(), new Vector3(2, 0, 0), 0.1, 0.3, 0, false, true, 0.75, true);
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
