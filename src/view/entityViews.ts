import { Color, Group, Matrix4, type PerspectiveCamera, Quaternion, type Texture, Vector3 } from 'three';
import { assert } from '../core/assert';
import { clamp, lerp } from '../core/math';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import type { BattleState, SimEvent } from '../sim/types';
import { ATTACK_DURATION, attackKindFor, type Motion, type Pose, samplePose } from './animation';
import { tileHeight } from './coords';
import { createShadows } from './shadows';
import { createSpriteBatch } from './spriteBatch';
import { createSprite } from './sprites';

interface EntityView {
  visual: ReturnType<typeof createSprite>;
  motion: Motion;
  pose: Pose;
  height: number;
  direction: number;
  flying: boolean;
  hitDelays: number[];
  hitStop: number;
  spawnDelay: number;
  exitDelay: number;
  art: string;
}

const HIT_STOP_SEC = 0.045;

export function createEntityViews(content: ContentDb, board: Board, textures: ReadonlyMap<string, Texture>) {
  const group = new Group();
  const views = new Map<number, EntityView>();
  const shadows = createShadows();
  const sprites = createSpriteBatch(textures);
  const spriteMatrix = new Matrix4();
  const billboard = new Quaternion();
  const white = new Color('#ffffff');
  group.add(shadows.group);
  group.add(sprites.group);
  const heights: Record<string, number> = {
    jelly: 0.75,
    hardJelly: 0.85,
    crow: 0.7,
    splitJelly: 0.85,
    miniJelly: 0.65,
    spitter: 0.8,
    kingJelly: 1.2,
    dashJelly: 0.75,
    crystalJelly: 0.85,
    shieldJelly: 0.85,
    sproutJelly: 0.8,
    flowerJelly: 0.85,
    drummerJelly: 0.9,
    nestJelly: 1,
    armoredCrow: 0.85,
  };
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
    visual.shadow.visible = false;
    visual.sprite.visible = false;
    const view: EntityView = {
      visual,
      height,
      flying,
      direction: 1,
      hitDelays: [],
      hitStop: 0,
      spawnDelay: 0,
      exitDelay: 0,
      art: art || id,
      motion: {
        kind: enemy ? (flying ? 'air' : 'ground') : 'unit',
        age: 0,
        clock: 0,
        phase: uid * 1.7,
        attack: 0,
        attackKind: attackKindFor(art || id),
        hit: 0,
        active: false,
        stunned: false,
        exit: null,
        exitAge: 0,
      },
      pose: { x: 0, y: 0, scaleX: 1, scaleY: 1, flash: 0, opacity: 1, rotation: 0 },
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
    attackOrigin(uid: number): Vector3 | undefined {
      const view = views.get(uid);
      if (!view) return undefined;
      // 오른쪽 무기 끝을 빌보드의 실제 변환으로 월드 좌표에 맞춥니다.
      const tipY =
        view.art === 'sheep' ? 0.49 : view.art === 'cat' ? 0.42 : view.art === 'bear' ? 0.36 : 0.18;
      const tip = new Vector3(0.4, tipY, 0);
      view.visual.group.updateMatrixWorld(true);
      return view.visual.sprite.localToWorld(tip);
    },
    onEvents(
      events: readonly SimEvent[],
      state: Readonly<BattleState>,
      delays: ReadonlyMap<SimEvent, number>,
    ) {
      for (const event of events) {
        if (event.type === 'unitDeploy') {
          const view = ensure(event.uid, event.unitId, false);
          view.direction = event.dir === 'left' ? -1 : 1;
          samplePose(view.motion, reduced, view.pose);
          const { visual, pose } = view;
          visual.sprite.position.set(pose.x * view.direction, pose.y, 0);
          visual.sprite.scale.set(view.height * pose.scaleX * view.direction, view.height * pose.scaleY, 1);
          visual.sprite.quaternion.copy(billboard);
          place(
            view,
            event.tile.x + 0.5,
            event.tile.y + 0.5,
            tileHeight(board.kindAt(event.tile.x, event.tile.y) ?? 'high'),
          );
        }
        if (event.type === 'enemySpawn') {
          const enemy = state.enemies.find((enemy) => enemy.uid === event.uid);
          const view = ensure(event.uid, event.enemyId, true);
          view.spawnDelay = delays.get(event) ?? 0;
          place(view, enemy?.x ?? event.x, enemy?.y ?? event.y, 0);
        }
        if (event.type === 'attack' || event.type === 'skillStart') {
          const view = views.get(event.type === 'attack' ? event.src.uid : event.uid);
          if (view) view.motion.attack = ATTACK_DURATION[view.motion.attackKind];
        }
        if (event.type === 'damage') {
          const view = views.get(event.dst.uid);
          if (view) {
            const delay = delays.get(event) ?? 0;
            if (delay > 0) view.hitDelays.push(delay);
            else {
              view.motion.hit = 0.08;
              view.hitStop = HIT_STOP_SEC;
            }
          }
        }
        if (event.type === 'enemyDie' || event.type === 'enemyLeak') {
          const view = views.get(event.uid);
          if (view) {
            view.motion.exit = event.type === 'enemyDie' ? 'death' : 'leak';
            view.motion.exitAge = 0;
            view.exitDelay = delays.get(event) ?? 0;
            view.visual.sprite.material.transparent = true;
            view.visual.sprite.material.depthWrite = false;
          }
        }
      }
    },
    update(state: Readonly<BattleState>, camera: PerspectiveCamera, alpha: number, dt: number) {
      billboard.copy(camera.quaternion);
      shadows.begin();
      sprites.begin();
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
        if (reduced || view.hitStop <= dt)
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
        view.spawnDelay = Math.max(0, view.spawnDelay - dt);
        motion.age += dt;
        motion.attack = Math.max(0, motion.attack - dt);
        motion.hit = Math.max(0, motion.hit - dt);
        view.hitStop = Math.max(0, view.hitStop - dt);
        for (let i = view.hitDelays.length - 1; i >= 0; i--) {
          const remaining = (view.hitDelays[i] ?? 0) - dt;
          if (remaining <= 0) {
            motion.hit = 0.08;
            view.hitStop = Math.max(view.hitStop, HIT_STOP_SEC + remaining);
            view.hitDelays.splice(i, 1);
          } else view.hitDelays[i] = remaining;
        }
        if (motion.exit) {
          motion.exitAge += Math.max(0, dt - view.exitDelay);
          view.exitDelay = Math.max(0, view.exitDelay - dt);
        }
        if (motion.exitAge >= (motion.exit === 'death' ? 0.25 : 0.2)) {
          remove(uid, view);
          continue;
        }
        if (view.spawnDelay > 0) continue;
        if (reduced || view.hitStop === 0) samplePose(motion, reduced, view.pose);
        else view.pose.flash = clamp(motion.hit / 0.08, 0, 1);
        const { visual, pose } = view;
        visual.sprite.position.set(pose.x * view.direction, (view.flying ? 1.2 : 0) + pose.y, 0);
        visual.sprite.scale.set(view.height * pose.scaleX * view.direction, view.height * pose.scaleY, 1);
        visual.sprite.quaternion.copy(camera.quaternion);
        visual.sprite.rotateZ(pose.rotation * view.direction);
        shadows.add(visual.group.position, view.flying, pose.y, pose.opacity);
        const { uFlash, uOpacity } = visual.sprite.material.uniforms;
        if (uFlash) uFlash.value = pose.flash;
        if (uOpacity) uOpacity.value = pose.opacity;
        visual.group.updateMatrix();
        visual.sprite.updateMatrix();
        spriteMatrix.multiplyMatrices(visual.group.matrix, visual.sprite.matrix);
        sprites.add(
          view.art,
          spriteMatrix,
          pose.flash,
          pose.opacity,
          visual.sprite.material.uniforms.uTint?.value ?? white,
        );
        visual.ring.visible = motion.active;
        visual.ring.material.opacity = reduced ? 0.55 : 0.45 + Math.sin(motion.clock * 6) * 0.15;
        visual.ring.scale.setScalar(reduced ? 1 : 1 + Math.sin(motion.clock * 6) * 0.08);
      }
      shadows.end();
      sprites.end();
    },
    dispose() {
      for (const view of views.values()) view.visual.dispose();
      views.clear();
      shadows.dispose();
      sprites.dispose();
      group.clear();
    },
  };
}
