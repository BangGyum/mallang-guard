import { InstancedMesh, PerspectiveCamera, ShaderMaterial, Texture } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import type { SimEvent } from '../../src/sim/types';
import { createEntityViews } from '../../src/view/entityViews';
import { impactDelays } from '../../src/view/eventTiming';
import { makeRawContent } from '../dataFixtures';
import { laneStage, makeContent } from '../helpers';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function fixture(hp = 600) {
  const stage = laneStage(
    ['S..G', 'HHHH'],
    [{ wave: 1, atSec: 0, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
  );
  const content = makeContent({
    stages: [stage],
    enemies: makeRawContent().enemies.map((enemy) => ({ ...enemy, hp })),
  });
  const battle = createBattle(content, stage.id);
  const textures = new Map(
    [...content.units.values(), ...content.enemies.values()].map((def) => [def.art, new Texture()]),
  );
  const view = createEntityViews(content, battle.stage.board, textures);
  const camera = new PerspectiveCamera();
  function deliver(events: SimEvent[]) {
    view.onEvents(events, battle.state, impactDelays(events));
  }
  function attack(source: number, uid: number) {
    deliver([
      {
        type: 'attack',
        src: { kind: 'unit', uid: source },
        dst: { kind: 'enemy', uid },
        ranged: true,
        damageType: 'physical',
      },
      {
        type: 'damage',
        src: { kind: 'unit', uid: source },
        dst: { kind: 'enemy', uid },
        amount: 100,
        damageType: 'physical',
      },
    ]);
  }
  return {
    battle,
    view,
    deliver,
    attack,
    render(dt: number) {
      view.update(battle.state, camera, 1, dt);
    },
    flash() {
      let value = 0;
      view.group.traverse((node) => {
        if (
          node instanceof InstancedMesh &&
          node.material instanceof ShaderMaterial &&
          node.material.uniforms.map?.value === textures.get('jelly')
        )
          value = node.geometry.getAttribute('aFlash').getX(0);
      });
      return value;
    },
    dispose() {
      view.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

describe('이벤트 경계의 캐릭터 연출', () => {
  it('등장한 틱에 처치되어 state에서 사라져도 투사체와 사망 대상을 유지한다', () => {
    const f = fixture(1);
    try {
      f.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
      const events = f.battle.step();
      const spawn = events.find((event) => event.type === 'enemySpawn');
      expect(spawn).toBeDefined();
      expect(events.some((event) => event.type === 'enemyDie')).toBe(true);
      expect(f.battle.state.enemies).toHaveLength(0);
      f.deliver(events);
      f.render(0.1);
      expect(f.view.position(spawn?.uid ?? -1)).toBeDefined();
      f.render(0.5);
      expect(f.view.position(spawn?.uid ?? -1)).toBeUndefined();
    } finally {
      f.dispose();
    }
  });
  it('서로 다른 친구의 연속 원거리 공격이 앞선 피격을 취소하지 않는다', () => {
    const f = fixture();
    try {
      f.deliver(f.battle.step());
      const uid = f.battle.state.enemies[0]?.uid ?? -1;
      f.attack(10, uid);
      f.render(0.15);
      f.attack(11, uid);
      f.render(0.1);
      expect(f.flash()).toBeGreaterThan(0);
      f.render(0.15);
      expect(f.flash()).toBeGreaterThan(0);
    } finally {
      f.dispose();
    }
  });
});
