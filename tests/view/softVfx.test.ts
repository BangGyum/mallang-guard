import { InstancedMesh, Matrix4, PerspectiveCamera, ShaderMaterial, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { assert } from '../../src/core/assert';
import { hashState } from '../../src/sim/hash';
import { attackEnemies } from '../../src/sim/systems/attack';
import type { BattleState, SimEvent } from '../../src/sim/types';
import { impactDelays } from '../../src/view/eventTiming';
import { createParticlePool } from '../../src/view/particlePool';
import { createVfx } from '../../src/view/vfx';
import { activateLine, lineBattle, lineEnemy } from '../sim/lineSniperFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function checkVfx(check: (f: ReturnType<typeof fixture>) => void) {
  const f = fixture();
  try {
    check(f);
  } finally {
    f.vfx.dispose();
    for (const texture of f.textures.values()) texture.dispose();
  }
}

function fixture() {
  const f = lineBattle();
  activateLine(f);
  const state: BattleState = structuredClone(f.battle.state);
  state.enemies = [lineEnemy(10, 3, -1), lineEnemy(11, 3), lineEnemy(12, 3, 1)];
  const textures = new Map(
    VFX_IDS.map((id) => {
      const texture = new Texture();
      texture.name = id;
      return [id, texture] as const;
    }),
  );
  const position = (uid: number) => {
    const enemy = state.enemies.find((entry) => entry.uid === uid);
    return enemy ? new Vector3(enemy.x, 0.4, enemy.y) : new Vector3(0, 1, 0);
  };
  const vfx = createVfx(f.db, f.battle.stage.board, textures, position, () => new Vector3(0, 1, 0));
  const camera = new PerspectiveCamera();
  const events: SimEvent[] = [];
  attackEnemies(f.db, f.battle.stage, state, events);
  const mesh = (id: string) => {
    const found = vfx.group.children.find(
      (node) =>
        node instanceof InstancedMesh &&
        node.material instanceof ShaderMaterial &&
        node.material.uniforms.map?.value.name === id,
    );
    assert(found instanceof InstancedMesh, `${id} 메시 없음`);
    return found;
  };
  return { ...f, state, textures, vfx, camera, events, mesh };
}

describe('무기별 전투 이펙트', () => {
  it('개별 투명도를 적용하고 슬롯을 재사용할 때 기본 투명도로 복원한다', () => {
    const texture = new Texture();
    const pool = createParticlePool(new Map(VFX_IDS.map((id) => [id, texture])));
    const camera = new PerspectiveCamera();
    const at = new Vector3();
    try {
      pool.emit('spark', at, at, 1, 0.2, 0, false, false, 0.25);
      pool.emit('spark', at, at, 1, 0.2);
      pool.begin(0.1, camera);
      const spark = pool.group.children.find((node) => node instanceof InstancedMesh && node.count === 2);
      assert(spark instanceof InstancedMesh, '스파크 없음');
      const alpha = spark.geometry.getAttribute('aOpacity');
      expect(alpha.getX(0)).toBeCloseTo(0.225);
      expect(alpha.getX(1)).toBeCloseTo(0.9);
      pool.begin(1, camera);
      pool.emit('spark', at, at, 1, 0.2);
      pool.begin(0.1, camera);
      expect(spark.count).toBe(1);
      expect(alpha.getX(0)).toBeCloseTo(0.9);
    } finally {
      pool.dispose();
      texture.dispose();
    }
  });

  it('삼중 사격은 중화기 탄환 세 발과 총구 섬광 하나를 표시한다', () =>
    checkVfx((f) => {
      const before = hashState(f.state);
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.03);
      expect(f.mesh('railRound').count).toBe(3);
      expect(f.mesh('muzzle').count).toBe(1);
      expect(f.mesh('muzzle').geometry.getAttribute('aOpacity').getX(0)).toBeLessThan(0.7);
      expect(f.mesh('ring').count).toBe(1);
      expect(hashState(f.state)).toBe(before);
    }));

  it('피격 파문은 탄환 도착 뒤에 나타나고 짧게 사라진다', () =>
    checkVfx((f) => {
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.12);
      f.vfx.update(f.state, f.camera, 0.12);
      expect(f.mesh('spark').count).toBe(0);
      expect(f.mesh('ring').count).toBe(1);
      f.vfx.update(f.state, f.camera, 0.02);
      expect(f.mesh('spark').count).toBe(15);
      expect(f.mesh('impact').count).toBe(3);
      expect(f.mesh('ring').count).toBe(4);
      expect(f.mesh('ring').geometry.getAttribute('aOpacity').getX(0)).toBeLessThan(0.25);
      f.vfx.update(f.state, f.camera, 0.31);
      expect(f.mesh('spark').count).toBe(0);
      expect(f.mesh('ring').count).toBe(1);
    }));

  it.each(['reduced', 'low'])('%s에서는 장식 파문을 생략하고 스킬 링은 고정한다', (mode) =>
    checkVfx((f) => {
      f.vfx.setOptions(mode === 'reduced', mode === 'low');
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.03);
      expect(f.mesh('railRound').count).toBe(3);
      const first = new Matrix4();
      f.mesh('ring').getMatrixAt(0, first);
      expect(f.mesh('ring').geometry.getAttribute('aOpacity').getX(0)).toBeCloseTo(0.14);
      f.vfx.update(f.state, f.camera, 0.24);
      const second = new Matrix4();
      f.mesh('ring').getMatrixAt(0, second);
      expect(second.elements).toEqual(first.elements);
      expect(f.mesh('ring').count).toBe(1);
      expect(f.mesh('spark').count).toBe(9);
      expect(f.mesh('impact').count).toBe(0);
    }),
  );

  it('정지 중에는 투사체·파문·스킬 링의 위치와 투명도가 유지된다', () =>
    checkVfx((f) => {
      f.vfx.onEvents(f.events, f.state, impactDelays(f.events));
      f.vfx.update(f.state, f.camera, 0.03);
      const snapshot = () =>
        f.vfx.group.children.map((node) => {
          assert(node instanceof InstancedMesh, '이펙트 메시 아님');
          return {
            count: node.count,
            matrix: [...node.instanceMatrix.array],
            opacity: [...node.geometry.getAttribute('aOpacity').array],
          };
        });
      const before = snapshot();
      for (let i = 0; i < 10; i++) f.vfx.update(f.state, f.camera, 0);
      expect(snapshot()).toEqual(before);
    }));

  it('스킬이 끝나면 발밑 링도 사라진다', () =>
    checkVfx((f) => {
      f.vfx.update(f.state, f.camera, 0.1);
      expect(f.mesh('ring').count).toBe(1);
      const unit = f.state.units[0];
      assert(unit, '유닛 없음');
      unit.skillState = 'charging';
      f.vfx.update(f.state, f.camera, 0);
      expect(f.mesh('ring').count).toBe(0);
    }));
});
