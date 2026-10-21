import { InstancedMesh, Matrix4, PerspectiveCamera, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { hashState } from '../../src/sim/hash';
import { createVfx } from '../../src/view/vfx';
import { rareFixture } from '../sim/rareFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function fixture(active: boolean, quiet = false) {
  const f = rareFixture('redPanda', active);
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
    () => new Vector3(4, 0, 0),
    () => new Vector3(0, 1, 0),
  );
  vfx.setOptions(quiet, quiet);
  const camera = new PerspectiveCamera();
  vfx.onEvents(
    [
      {
        type: 'attack',
        src: { kind: 'unit', uid: f.unit.uid },
        dst: { kind: 'enemy', uid: 100 },
        damageType: 'physical',
        ranged: true,
      },
    ],
    f.state,
    new Map(),
  );
  function read(id: string) {
    const mesh = vfx.group.children.find(
      (node) => node instanceof InstancedMesh && node.material.uniforms.map.value.name === id,
    );
    assert(mesh instanceof InstancedMesh, `${id} 없음`);
    const matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix);
    return {
      count: mesh.count,
      position: new Vector3().setFromMatrixPosition(matrix),
      scale: new Vector3().setFromMatrixScale(matrix).x,
      opacity: mesh.geometry.getAttribute('aOpacity').getX(0),
      matrix: matrix.elements,
    };
  }
  return {
    ...f,
    vfx,
    read,
    update: (dt: number) => vfx.update(f.state, camera, dt),
    dispose() {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

it.each([false, true])('유탄은 포물선 정점과 하강 자세를 거쳐 착탄 뒤 폭발한다 (스킬=%s)', (active) => {
  const f = fixture(active);
  try {
    const before = hashState(f.state);
    f.update(0.125);
    const peak = f.read('shellRound');
    expect(peak.count).toBe(1);
    expect(peak.position.x).toBeCloseTo(2);
    expect(peak.position.y).toBeGreaterThan(1.3);
    expect(peak.opacity).toBeGreaterThan(0.99);
    expect(f.read('shellBurst').count).toBe(0);
    f.update(0.075);
    const falling = f.read('shellRound');
    expect(falling.position.y).toBeLessThan(peak.position.y);
    expect(falling.scale).toBeCloseTo(peak.scale);
    expect(falling.opacity).toBeGreaterThan(0.8);
    expect(falling.matrix[1]).toBeLessThan(peak.matrix[1] ?? 0);
    f.update(0);
    expect(f.read('shellRound')).toEqual(falling);
    f.update(0.06);
    expect(f.read('shellRound').count).toBe(0);
    const blast = f.read('shellBurst');
    expect(blast.count).toBe(1);
    expect(blast.position.toArray()).toEqual([4, 0, 0]);
    f.update(0.08);
    expect(f.read('shellBurst').scale).toBeGreaterThan(blast.scale);
    expect(hashState(f.state)).toBe(before);
    f.update(1);
    expect(f.read('shellBurst').count).toBe(0);
  } finally {
    f.dispose();
  }
});

it.each([false, true])('스킬 유탄과 폭발은 평타보다 확실히 크다 (저품질/모션감소=%s)', (quiet) => {
  const normal = fixture(false, quiet);
  const skill = fixture(true, quiet);
  try {
    normal.update(0.1);
    skill.update(0.1);
    expect(skill.read('shellRound').scale / normal.read('shellRound').scale).toBeCloseTo(1.8);
    normal.update(0.2);
    skill.update(0.2);
    expect(skill.read('shellBurst').count).toBe(1);
    expect(normal.read('shellBurst').count).toBe(1);
    expect(skill.read('shellBurst').scale / normal.read('shellBurst').scale).toBeCloseTo(1.8);
    expect(skill.vfx.count).toBeLessThanOrEqual(200);
  } finally {
    normal.dispose();
    skill.dispose();
  }
});
