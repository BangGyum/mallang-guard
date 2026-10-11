import { InstancedMesh, Matrix4, PerspectiveCamera, ShaderMaterial, Texture } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dir } from '../../src/core/grid';
import { createBattle } from '../../src/sim/battle';
import { tileHeight } from '../../src/view/coords';
import { createEntityViews } from '../../src/view/entityViews';
import { makeRawContent } from '../dataFixtures';
import { laneStage, makeContent } from '../helpers';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

const stage = laneStage(['S..G', 'HHHH'], [], { startDp: 99 });
const content = makeContent({ stages: [stage] });
const cases = makeRawContent().units.flatMap((unit) =>
  (['up', 'right', 'down', 'left'] as Dir[]).flatMap((dir) =>
    [false, true].map((paused) => ({ unitId: unit.id, art: unit.art, dir, paused })),
  ),
);

describe('정지 중 새 유닛의 착지', () => {
  it.each(cases)('$unitId / $dir / 정지 $paused: 배치 칸에 표시하고 시간을 보존한다', (entry) => {
    const battle = createBattle(content, stage.id);
    const textures = new Map([...content.units.values()].map((unit) => [unit.art, new Texture()]));
    const view = createEntityViews(content, battle.stage.board, textures);
    const camera = new PerspectiveCamera();
    camera.position.set(5, 7, 5);
    camera.lookAt(0, 0, 0);
    const height = tileHeight('high');
    function spriteHeight() {
      let y: number | undefined;
      view.group.traverse((node) => {
        if (
          node instanceof InstancedMesh &&
          node.material instanceof ShaderMaterial &&
          node.material.uniforms.map?.value === textures.get(entry.art) &&
          node.count > 0
        ) {
          const matrix = new Matrix4();
          node.getMatrixAt(0, matrix);
          y = matrix.elements[13];
        }
      });
      return y;
    }
    try {
      view.update(battle.state, camera, 1, 0);
      battle.enqueue({ type: 'deploy', unitId: entry.unitId, tile: { x: 1, y: 1 }, dir: entry.dir });
      const events = battle.flush();
      const state = JSON.stringify(battle.state);
      view.onEvents(events, battle.state, new Map(), entry.paused);
      view.update(battle.state, camera, 1, 0);
      expect(spriteHeight()).toBeCloseTo(height + (entry.paused ? 0 : 1.2), 6);
      for (let i = 0; i < 10; i++) view.update(battle.state, camera, 1, 0);
      expect(spriteHeight()).toBeCloseTo(height + (entry.paused ? 0 : 1.2), 6);
      view.update(battle.state, camera, 1, 0.01);
      if (entry.paused) expect(spriteHeight()).toBeCloseTo(height, 6);
      view.update(battle.state, camera, 1, 0.4);
      expect(spriteHeight()).toBeCloseTo(height, 6);
      expect(JSON.stringify(battle.state)).toBe(state);
    } finally {
      view.dispose();
      for (const texture of textures.values()) texture.dispose();
    }
  });
});
