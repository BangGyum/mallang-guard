import { InstancedMesh, PerspectiveCamera, ShaderMaterial, Texture } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dir } from '../../src/core/grid';
import type { ArtId } from '../../src/data/types';
import { createBattle } from '../../src/sim/battle';
import type { SimEvent } from '../../src/sim/types';
import { createEntityViews } from '../../src/view/entityViews';
import { impactDelays } from '../../src/view/eventTiming';
import { makeRawContent } from '../dataFixtures';
import { laneStage, makeContent } from '../helpers';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function fixture(hp = 600, enemyId = 'jelly', startDp = 10) {
  const stage = laneStage(
    ['S..G', 'HHHH'],
    [{ wave: 1, atSec: 0, enemy: enemyId, count: 1, intervalSec: 0, route: 'ground' }],
    { startDp },
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
    camera,
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
    visibleCount(art: ArtId) {
      let count = 0;
      view.group.traverse((node) => {
        if (
          node instanceof InstancedMesh &&
          node.material instanceof ShaderMaterial &&
          node.material.uniforms.map?.value === textures.get(art)
        )
          count += node.count;
      });
      return count;
    },
    dispose() {
      view.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

describe('이벤트 경계의 캐릭터 연출', () => {
  it.each(
    makeRawContent().units.flatMap((unit) =>
      (['up', 'right', 'down', 'left'] as Dir[]).map((dir) => ({ unitId: unit.id, dir })),
    ),
  )('$unitId / $dir 배치 이벤트 직후 무기 좌표가 첫 렌더와 일치한다', ({ unitId, dir }) => {
    const f = fixture(600, 'jelly', 99);
    try {
      f.camera.position.set(5, 7, 5);
      f.camera.lookAt(0, 0, 0);
      f.render(0);
      f.battle.enqueue({ type: 'deploy', unitId, tile: { x: 1, y: 1 }, dir });
      f.deliver(f.battle.flush());
      const uid = f.battle.state.units[0]?.uid ?? -1;
      const before = f.view.attackOrigin(uid);
      f.render(0);
      const visible = f.view.attackOrigin(uid);
      if (!before || !visible) throw new Error('배치한 무기 좌표 없음');
      expect(before.distanceTo(visible)).toBeLessThan(0.001);
    } finally {
      f.dispose();
    }
  });
  it('부모의 투사체가 도착하기 전에는 분열 자식을 그리지 않는다', () => {
    const f = fixture(1, 'splitJelly');
    try {
      f.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
      f.deliver(f.battle.step());
      expect(f.battle.state.enemies).toHaveLength(2);
      f.render(0.1);
      expect(f.visibleCount('miniJelly')).toBe(0);
      f.render(0.16);
      expect(f.visibleCount('miniJelly')).toBe(2);
    } finally {
      f.dispose();
    }
  });
  it('피격한 적만 45ms 동안 위치를 붙잡고 이후 현재 전투 위치로 복귀한다', () => {
    const f = fixture();
    try {
      f.deliver(f.battle.step());
      f.render(0.1);
      const uid = f.battle.state.enemies[0]?.uid ?? -1;
      const x = f.view.position(uid)?.x;
      f.deliver([
        { type: 'damage', src: null, dst: { kind: 'enemy', uid }, amount: 1, damageType: 'physical' },
      ]);
      f.battle.step();
      f.render(0.02);
      expect(f.view.position(uid)?.x).toBe(x);
      expect(f.flash()).toBeGreaterThan(0);
      f.render(0);
      f.render(0.02);
      expect(f.view.position(uid)?.x).toBe(x);
      f.render(0.01);
      expect(f.view.position(uid)?.x).toBeGreaterThan(x ?? 0);
    } finally {
      f.dispose();
    }
  });
  it('원거리 피격은 투사체 도착 이후에만 히트스톱을 시작한다', () => {
    const f = fixture();
    try {
      f.deliver(f.battle.step());
      f.render(0.1);
      const uid = f.battle.state.enemies[0]?.uid ?? -1;
      const before = f.view.position(uid)?.x;
      f.attack(10, uid);
      f.battle.step();
      f.render(0.2);
      expect(f.view.position(uid)?.x).toBeGreaterThan(before ?? 0);
      f.render(0.05);
      const impact = f.view.position(uid)?.x;
      f.battle.step();
      f.render(0.02);
      expect(f.view.position(uid)?.x).toBe(impact);
      f.render(0.03);
      expect(f.view.position(uid)?.x).toBeGreaterThan(impact ?? 0);
    } finally {
      f.dispose();
    }
  });
  it('모션 감소에서는 히트스톱을 생략한다', () => {
    const f = fixture();
    try {
      f.deliver(f.battle.step());
      f.render(0.1);
      const uid = f.battle.state.enemies[0]?.uid ?? -1;
      const x = f.view.position(uid)?.x;
      f.deliver([
        { type: 'damage', src: null, dst: { kind: 'enemy', uid }, amount: 1, damageType: 'physical' },
      ]);
      f.view.setReducedMotion(true);
      f.battle.step();
      f.render(0.01);
      expect(f.view.position(uid)?.x).toBeGreaterThan(x ?? 0);
    } finally {
      f.dispose();
    }
  });
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
  it('왼쪽으로 배치한 첫 틱부터 무기 끝 발사 위치가 왼쪽에 있다', () => {
    const f = fixture();
    try {
      f.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'left' });
      f.deliver(f.battle.step());
      const uid = f.battle.state.units[0]?.uid ?? -1;
      expect(f.view.attackOrigin(uid)?.x).toBeLessThan(f.view.position(uid)?.x ?? 0);
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
