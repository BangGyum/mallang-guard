import { InstancedMesh, Matrix4, PerspectiveCamera, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { hashState } from '../../src/sim/hash';
import { createVfx } from '../../src/view/vfx';
import { rareFixture } from '../sim/rareFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

it.each([
  ['cat', 'slash', 'crescentSlash'],
  ['bear', 'shockwave', 'hammerWave'],
  ['penguin', 'iceRound', 'iceLance'],
  ['sheep', 'arcBolt', 'cometRound'],
  ['owl', 'fireball', 'infernoRound'],
  ['fox', 'mintRailRound', 'chargedRail'],
  ['snowLeopard', 'gravityOrb', 'gravityCore'],
])('%s는 활성 중에만 전용 탄체를 쓰며 발사 뒤 스킬이 끝나도 이미 쏜 탄을 유지한다', (id, normal, skill) => {
  for (const quiet of [false, true]) {
    const f = rareFixture(id);
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
      () => new Vector3(4, 1, 0),
      () => new Vector3(0, 1, 0),
    );
    const camera = new PerspectiveCamera();
    const mesh = (name: string) => {
      const found = vfx.group.children.find(
        (node) => node instanceof InstancedMesh && node.material.uniforms.map.value.name === name,
      );
      assert(found instanceof InstancedMesh, '투사체 없음');
      return found;
    };
    const fire = () =>
      vfx.onEvents(
        [
          {
            type: 'attack',
            src: { kind: 'unit', uid: f.unit.uid },
            dst: { kind: 'enemy', uid: 100 },
            damageType: f.def.damageType,
            ranged: true,
          },
        ],
        f.state,
        new Map(),
      );
    try {
      vfx.setOptions(quiet, quiet);
      fire();
      vfx.update(f.state, camera, 0.12);
      expect(mesh(normal).count).toBeGreaterThan(0);
      expect(mesh(skill).count).toBe(0);
      vfx.update(f.state, camera, 0.6);
      f.unit.skillState = 'active';
      fire();
      f.unit.skillState = 'charging';
      const before = hashState(f.state);
      vfx.update(f.state, camera, 0.2);
      expect(mesh(skill).count).toBe(1);
      expect(mesh(normal).count).toBe(0);
      expect(mesh(skill).geometry.getAttribute('aOpacity').getX(0)).toBeGreaterThan(0.45);
      const matrix = [...mesh(skill).instanceMatrix.array];
      vfx.update(f.state, camera, 0);
      expect([...mesh(skill).instanceMatrix.array]).toEqual(matrix);
      vfx.update(f.state, camera, 0.06);
      // 같은 그림으로 그리는 작은 파편은 도착 지점에만 남습니다.
      const matrixAtImpact = new Matrix4();
      for (let index = 0; index < mesh(skill).count; index++) {
        mesh(skill).getMatrixAt(index, matrixAtImpact);
        expect(new Vector3().setFromMatrixPosition(matrixAtImpact).x).toBeGreaterThan(3.8);
      }
      expect(hashState(f.state)).toBe(before);
      vfx.update(f.state, camera, 0.6);
      fire();
      vfx.update(f.state, camera, 0.12);
      expect(mesh(normal).count).toBeGreaterThan(0);
      expect(mesh(skill).count).toBe(0);
    } finally {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    }
  }
});
