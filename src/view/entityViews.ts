import { Group, type PerspectiveCamera, type Texture, Vector3 } from 'three';
import { assert } from '../core/assert';
import { lerp } from '../core/math';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import type { BattleState, SimEvent } from '../sim/types';
import { type Motion, type Pose, samplePose } from './animation';
import { tileHeight } from './coords';
import { createSprite } from './sprites';

interface EntityView {
  visual: ReturnType<typeof createSprite>;
  motion: Motion;
  pose: Pose;
  height: number;
  direction: number;
  flying: boolean;
}

export function createEntityViews(content: ContentDb, board: Board, textures: ReadonlyMap<string, Texture>) {
  const group = new Group();
  const views = new Map<number, EntityView>();
  const heights: Record<string, number> = { jelly: 0.75, hardJelly: 0.85, crow: 0.7 };
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ensure(uid: number, id: string, enemy: boolean): EntityView {
    const existing = views.get(uid);
    if (existing) return existing;
    const art = (enemy ? content.enemies.get(id) : content.units.get(id))?.art;
    const texture = art && textures.get(art);
    assert(texture, `캐릭터 그림이 없습니다: ${id}`);
    const flying = enemy && !!content.enemies.get(id)?.flying;
    const height = enemy ? (heights[id] ?? 0.75) : 0.9;
    const visual = createSprite(texture, height, flying);
    const view: EntityView = {
      visual,
      height,
      flying,
      direction: 1,
      motion: {
        kind: enemy ? (flying ? 'air' : 'ground') : 'unit',
        age: 0,
        clock: 0,
        phase: uid * 1.7,
        attack: 0,
        hit: 0,
        active: false,
        stunned: false,
        exit: null,
        exitAge: 0,
      },
      pose: { x: 0, y: 0, scaleX: 1, scaleY: 1, flash: 0, opacity: 1 },
    };
    views.set(uid, view);
    group.add(visual.group);
    return view;
  }
  function place(view: EntityView, x: number, y: number, elevation: number) {
    view.visual.group.position.set(x - board.width / 2, elevation, y - board.height / 2);
  }
  function remove(uid: number, view: EntityView) {
    group.remove(view.visual.group);
    view.visual.dispose();
    views.delete(uid);
  }
  return {
    group,
    setReducedMotion(value: boolean) {
      reduced = value;
    },
    position(uid: number): Vector3 | undefined {
      const view = views.get(uid);
      return view?.visual.group.position
        .clone()
        .add(new Vector3(0, (view.flying ? 1.2 : 0) + view.height * 0.45, 0));
    },
    onEvents(events: readonly SimEvent[], state: Readonly<BattleState>) {
      for (const event of events) {
        if (event.type === 'unitDeploy') {
          const view = ensure(event.uid, event.unitId, false);
          place(
            view,
            event.tile.x + 0.5,
            event.tile.y + 0.5,
            tileHeight(board.kindAt(event.tile.x, event.tile.y) ?? 'high'),
          );
        }
        if (event.type === 'enemySpawn') {
          const enemy = state.enemies.find((enemy) => enemy.uid === event.uid);
          if (enemy) place(ensure(enemy.uid, enemy.enemyId, true), enemy.x, enemy.y, 0);
        }
        if (event.type === 'attack') {
          const view = views.get(event.src.uid);
          if (view) view.motion.attack = 0.1;
        }
        if (event.type === 'damage') {
          const view = views.get(event.dst.uid);
          if (view) view.motion.hit = 0.08;
        }
        if (event.type === 'enemyDie' || event.type === 'enemyLeak') {
          const view = views.get(event.uid);
          if (view) {
            view.motion.exit = event.type === 'enemyDie' ? 'death' : 'leak';
            view.motion.exitAge = 0;
            view.visual.sprite.material.transparent = true;
            view.visual.sprite.material.depthWrite = false;
          }
        }
      }
    },
    update(state: Readonly<BattleState>, camera: PerspectiveCamera, alpha: number, dt: number) {
      const alive = new Set<number>();
      for (const unit of state.units) {
        alive.add(unit.uid);
        const view = ensure(unit.uid, unit.unitId, false);
        place(
          view,
          unit.tile.x + 0.5,
          unit.tile.y + 0.5,
          tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'ground'),
        );
        view.direction = unit.dir === 'left' ? -1 : 1;
        view.motion.active = unit.skillState === 'active';
        view.motion.clock += dt;
      }
      for (const enemy of state.enemies) {
        alive.add(enemy.uid);
        const view = ensure(enemy.uid, enemy.enemyId, true);
        place(view, lerp(enemy.px, enemy.x, alpha), lerp(enemy.py, enemy.y, alpha), 0);
        if (enemy.x !== enemy.px) view.direction = Math.sign(enemy.x - enemy.px);
        view.motion.stunned = enemy.stunUntilTick > state.tick;
        if (!view.motion.stunned)
          view.motion.clock +=
            ((dt * (content.enemies.get(enemy.enemyId)?.speed ?? 0.9)) / 0.9) * (1 - enemy.slowAmount);
        const tint = view.visual.sprite.material.uniforms.uTint;
        if (tint)
          tint.value.set(view.motion.stunned ? '#e4d9ff' : enemy.slowAmount > 0 ? '#c6e9ff' : '#ffffff');
      }
      for (const [uid, view] of views) {
        if (!alive.has(uid) && !view.motion.exit) {
          remove(uid, view);
          continue;
        }
        const motion = view.motion;
        motion.age += dt;
        motion.attack = Math.max(0, motion.attack - dt);
        motion.hit = Math.max(0, motion.hit - dt);
        if (motion.exit) motion.exitAge += dt;
        if (motion.exitAge >= (motion.exit === 'death' ? 0.25 : 0.2)) {
          remove(uid, view);
          continue;
        }
        samplePose(motion, reduced, view.pose);
        const { visual, pose } = view;
        visual.sprite.position.set(pose.x * view.direction, (view.flying ? 1.2 : 0) + pose.y, 0);
        visual.sprite.scale.set(view.height * pose.scaleX * view.direction, view.height * pose.scaleY, 1);
        visual.sprite.quaternion.copy(camera.quaternion);
        visual.shadow.position.y = 0.012;
        visual.shadow.scale.set(1 - Math.max(0, pose.y) * 0.2, 0.65, 1);
        visual.shadow.material.opacity = (view.flying ? 0.14 : 0.22) * pose.opacity;
        const { uFlash, uOpacity } = visual.sprite.material.uniforms;
        if (uFlash) uFlash.value = pose.flash;
        if (uOpacity) uOpacity.value = pose.opacity;
        visual.ring.visible = motion.active;
        visual.ring.material.opacity = reduced ? 0.55 : 0.45 + Math.sin(motion.clock * 6) * 0.15;
        visual.ring.scale.setScalar(reduced ? 1 : 1 + Math.sin(motion.clock * 6) * 0.08);
      }
    },
    dispose() {
      for (const view of views.values()) view.visual.dispose();
      views.clear();
      group.clear();
    },
  };
}
