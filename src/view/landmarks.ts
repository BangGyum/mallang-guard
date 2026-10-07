import {
  AdditiveBlending,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type PerspectiveCamera,
  RingGeometry,
  type Texture,
} from 'three';
import { assert } from '../core/assert';
import type { Board } from '../sim/board';
import type { SimEvent } from '../sim/types';
import { tileToWorld } from './coords';
import { createSprite } from './sprites';

export function createLandmarks(board: Board, textures: ReadonlyMap<string, Texture>) {
  const group = new Group();
  const portals: Group[] = [];
  const puddings: ReturnType<typeof createSprite>[] = [];
  const texture = textures.get('pudding');
  assert(texture, '푸딩 그림이 없습니다');
  const ringGeometry = new RingGeometry(0.31, 0.37, 40);
  const ringMaterial = new MeshBasicMaterial({
    color: '#e95e8a',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const dotGeometry = new CircleGeometry(0.028, 8);
  const dotMaterial = new MeshBasicMaterial({
    color: '#ffd5e7',
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const kind = board.kindAt(x, y);
      if (kind === 'spawn') {
        const portal = new Group();
        portal.position.copy(tileToWorld({ x, y }, board.width, board.height, 0.035));
        const ring = new Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        portal.add(ring);
        for (let i = 0; i < 12; i++) {
          const dot = new Mesh(dotGeometry, dotMaterial);
          const angle = (i / 12) * Math.PI * 4;
          const radius = 0.07 + i * 0.019;
          dot.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
          dot.rotation.x = -Math.PI / 2;
          portal.add(dot);
        }
        portals.push(portal);
        group.add(portal);
      }
      if (kind === 'goal') {
        const pudding = createSprite(texture, 0.8, false);
        pudding.group.position.copy(tileToWorld({ x, y }, board.width, board.height, 0.015));
        puddings.push(pudding);
        group.add(pudding.group);
      }
    }
  }
  let time = 0;
  let leak = 0;
  let reduced = false;
  return {
    group,
    setReducedMotion(value: boolean) {
      reduced = value;
    },
    onEvents(events: readonly SimEvent[]) {
      if (events.some((event) => event.type === 'enemyLeak')) leak = 0.3;
    },
    update(camera: PerspectiveCamera, dt: number) {
      time += dt;
      leak = Math.max(0, leak - dt);
      for (const portal of portals) {
        portal.rotation.y = reduced ? 0 : time * 0.8;
        portal.scale.setScalar(reduced ? 1 : 1 + Math.sin(time * 3) * 0.07);
      }
      for (const pudding of puddings) {
        pudding.sprite.quaternion.copy(camera.quaternion);
        pudding.sprite.position.x = reduced ? 0 : Math.sin(leak * 65) * leak * 0.2;
        const flash = pudding.sprite.material.uniforms.uFlash;
        if (flash) flash.value = leak > 0 ? 0.3 : 0;
      }
    },
    dispose() {
      for (const pudding of puddings) pudding.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
      group.clear();
    },
  };
}
