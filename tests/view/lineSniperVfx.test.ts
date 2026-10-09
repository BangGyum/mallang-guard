import { InstancedMesh, Matrix4, PerspectiveCamera, ShaderMaterial, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assert } from '../../src/core/assert';
import { attackEnemies } from '../../src/sim/systems/attack';
import type { BattleState, SimEvent } from '../../src/sim/types';
import { impactDelays, PROJECTILE_SEC } from '../../src/view/eventTiming';
import { createVfx } from '../../src/view/vfx';
import { activateLine, lineBattle, lineEnemy } from '../sim/lineSniperFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

describe('랑랑의 동시 사격 투사체', () => {
  it.each([1, 3])('적 %i명에게 동일한 총구에서 실제 발수만큼 탄환을 보낸다', (count) => {
    const f = lineBattle();
    activateLine(f);
    const state: BattleState = structuredClone(f.battle.state);
    const unit = state.units[0];
    assert(unit, '랑랑 없음');
    state.enemies = Array.from({ length: count }, (_, i) => lineEnemy(10 + i, 3, i - 1));
    const events: SimEvent[] = [];
    attackEnemies(f.db, f.battle.stage, state, events);
    const textures = new Map(
      [
        'bullet',
        'iceRound',
        'arcBolt',
        'slash',
        'shockwave',
        'muzzle',
        'signal',
        'stickyDrop',
        'spark',
        'droplet',
        'goo',
        'stunStar',
        'ring',
      ].map((id) => {
        const texture = new Texture();
        texture.name = id;
        return [id, texture] as const;
      }),
    );
    const origin = new Vector3(0, 1, 0);
    const position = (uid: number) => {
      const enemy = state.enemies.find((enemy) => enemy.uid === uid);
      return enemy && new Vector3(enemy.x, 1, enemy.y);
    };
    const vfx = createVfx(f.db, f.battle.stage.board, textures, position, () => origin.clone());
    try {
      vfx.onEvents(events, state, impactDelays(events));
      const camera = new PerspectiveCamera();
      vfx.update(state, camera, 0.1);
      const bullet = vfx.group.children.find(
        (node) =>
          node instanceof InstancedMesh &&
          node.material instanceof ShaderMaterial &&
          node.material.uniforms.map?.value.name === 'bullet',
      );
      assert(bullet instanceof InstancedMesh, '탄환 메시 없음');
      expect(bullet.count).toBe(count);
      const shots = events.filter((event) => event.type === 'attack');
      for (const [index, shot] of shots.entries()) {
        const matrix = new Matrix4();
        bullet.getMatrixAt(index, matrix);
        const at = new Vector3().setFromMatrixPosition(matrix);
        const end = position(shot.dst.uid);
        assert(end, '탄환 대상 없음');
        const expected = origin.clone().lerp(end, 0.1 / PROJECTILE_SEC);
        expect(at.distanceTo(expected)).toBeLessThan(0.00001);
      }
      for (const event of events.filter((event) => event.type === 'damage'))
        expect(impactDelays(events).get(event)).toBe(PROJECTILE_SEC);
      vfx.update(state, camera, PROJECTILE_SEC);
      expect(bullet.count).toBe(0);
    } finally {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    }
  });
});
