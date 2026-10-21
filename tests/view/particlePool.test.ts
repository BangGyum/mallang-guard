import { DynamicDrawUsage, InstancedMesh, PerspectiveCamera, Texture, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { createParticlePool } from '../../src/view/particlePool';

it('빈 파티클은 업로드하지 않고 다시 나타난 그림의 위치·투명도만 갱신한다', () => {
  const textures = new Map(VFX_IDS.map((id) => [id, new Texture()]));
  const pool = createParticlePool(textures);
  const camera = new PerspectiveCamera();
  const at = new Vector3(1, 2, 3);
  const mesh = pool.group.children.find(
    (node) => node instanceof InstancedMesh && node.material.uniforms.map.value === textures.get('spark'),
  );
  assert(mesh instanceof InstancedMesh, '스파크 메시 없음');
  const opacity = mesh.geometry.getAttribute('aOpacity');
  try {
    pool.begin(0, camera);
    pool.end();
    expect(mesh.visible).toBe(false);
    expect(mesh.instanceMatrix.version).toBe(0);
    expect(mesh.instanceMatrix.usage).toBe(DynamicDrawUsage);
    pool.emit('spark', at, at, 0.1, 0.2);
    pool.emit('spark', at, at, 0.1, 0.2);
    pool.begin(0.02, camera);
    pool.end();
    expect(mesh.visible).toBe(true);
    expect(mesh.count).toBe(2);
    expect(mesh.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 32 }]);
    expect(opacity.updateRanges).toEqual([{ start: 0, count: 2 }]);
    const version = mesh.instanceMatrix.version;
    pool.begin(0.2, camera);
    pool.end();
    expect(mesh.visible).toBe(false);
    expect(mesh.count).toBe(0);
    expect(mesh.instanceMatrix.version).toBe(version);
    at.set(4, 5, 6);
    pool.emit('spark', at, at, 0.2, 0.3, 0, false, false, 0.5);
    pool.begin(0.02, camera);
    pool.end();
    expect(mesh.visible).toBe(true);
    expect(mesh.count).toBe(1);
    expect([...mesh.instanceMatrix.array].slice(12, 15)).toEqual([4, 5, 6]);
    expect(opacity.getX(0)).toBeCloseTo(0.45);
    expect(mesh.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }]);
    expect(opacity.updateRanges).toEqual([{ start: 0, count: 1 }]);
  } finally {
    pool.dispose();
    for (const texture of textures.values()) texture.dispose();
  }
});
