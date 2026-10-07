import { Group, type PerspectiveCamera } from 'three';
import { assert } from '../core/assert';
import { lerp } from '../core/math';
import type { ContentDb, Role } from '../data/types';
import type { Board } from '../sim/board';
import type { BattleState, SimEvent } from '../sim/types';
import { tileHeight } from './coords';
import { createSprite } from './sprites';
import { createTextures } from './textures';

interface EntityView {
  visual: ReturnType<typeof createSprite>;
  flash: number;
}

export function createEntityViews(
  content: ContentDb,
  board: Board,
  roleColors: Readonly<Record<Role, string>>,
) {
  const group = new Group();
  const cache = createTextures(content, roleColors);
  const views = new Map<number, EntityView>();
  const heights: Record<string, number> = { jelly: 0.75, hardJelly: 0.85, crow: 0.7 };
  function ensure(uid: number, id: string, enemy: boolean): EntityView {
    const existing = views.get(uid);
    if (existing) return existing;
    const texture = cache.textures.get(id);
    assert(texture, `캐릭터 그림이 없습니다: ${id}`);
    const visual = createSprite(
      texture,
      enemy ? (heights[id] ?? 0.75) : 0.9,
      enemy && !!content.enemies.get(id)?.flying,
    );
    const view = { visual, flash: 0 };
    views.set(uid, view);
    group.add(visual.group);
    return view;
  }
  function place(
    view: EntityView,
    x: number,
    y: number,
    elevation: number,
    flying: boolean,
    camera: PerspectiveCamera,
    dt: number,
  ) {
    view.visual.sprite.position.set(
      x - board.width / 2,
      elevation + (flying ? 1.2 : 0),
      y - board.height / 2,
    );
    view.visual.sprite.quaternion.copy(camera.quaternion);
    view.visual.shadow.position.set(x - board.width / 2, elevation + 0.012, y - board.height / 2);
    view.flash = Math.max(0, view.flash - dt);
    view.visual.sprite.material.color.set(view.flash > 0 ? '#ffd0da' : '#ffffff');
  }
  return {
    group,
    onEvents(events: readonly SimEvent[]) {
      for (const event of events)
        if (event.type === 'damage') {
          const view = views.get(event.dst.uid);
          if (view) view.flash = 0.15;
        }
    },
    update(state: Readonly<BattleState>, camera: PerspectiveCamera, alpha: number, dt: number) {
      const alive = new Set<number>();
      for (const unit of state.units) {
        alive.add(unit.uid);
        const view = ensure(unit.uid, unit.unitId, false);
        const elevation = tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'ground');
        place(view, unit.tile.x + 0.5, unit.tile.y + 0.5, elevation, false, camera, dt);
      }
      for (const enemy of state.enemies) {
        alive.add(enemy.uid);
        const view = ensure(enemy.uid, enemy.enemyId, true);
        const flying = !!content.enemies.get(enemy.enemyId)?.flying;
        place(view, lerp(enemy.px, enemy.x, alpha), lerp(enemy.py, enemy.y, alpha), 0, flying, camera, dt);
      }
      for (const [uid, view] of views)
        if (!alive.has(uid)) {
          group.remove(view.visual.group);
          view.visual.dispose();
          views.delete(uid);
        }
    },
    dispose() {
      for (const view of views.values()) view.visual.dispose();
      views.clear();
      group.clear();
      cache.dispose();
    },
  };
}
