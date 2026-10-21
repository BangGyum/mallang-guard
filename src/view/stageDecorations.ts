import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  type DataTexture,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  type Matrix4,
  MeshToonMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mulberry32 } from '../core/rng';
import type { StageTheme } from '../data/stageThemes';
import type { Board } from '../sim/board';
import { tileHeight, tileToWorld } from './coords';

type Shape = 'box' | 'leaf' | 'ball' | 'post' | 'ring';
interface Decoration {
  matrix: Matrix4;
  color: string;
}

export function createStageDecorations(board: Board, theme: StageTheme, gradient: DataTexture): Group {
  const group = new Group();
  group.name = `decorations-${theme.id}`;
  const batches: Record<Shape, Decoration[]> = { box: [], leaf: [], ball: [], post: [], ring: [] };
  const transform = new Object3D();
  const top = tileHeight('blocked');
  function add(
    shape: Shape,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
  ) {
    transform.position.set(x, y, z);
    transform.scale.set(sx, sy, sz);
    transform.rotation.set(shape === 'ring' ? -Math.PI / 2 : 0, 0, 0);
    transform.updateMatrix();
    batches[shape].push({ matrix: transform.matrix.clone(), color });
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const kind = board.kindAt(x, y);
      const p = tileToWorld({ x, y }, board.width, board.height, top);
      if (kind === 'ground' || kind === 'path') {
        // 낮은 줄눈만 더해 경로와 고지대의 가독성을 유지합니다.
        if (theme.id === 'pond') {
          for (const offset of [-0.24, 0, 0.24])
            add('box', p.x + offset, 0.006, p.z, 0.012, 0.008, 0.82, theme.base);
        } else if ((x + y) % 2 === 0) {
          add('box', p.x, 0.006, p.z, 0.7, 0.008, 0.018, theme.trim);
        }
        continue;
      }
      if (kind !== 'blocked') continue;
      const seed = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
      const random = mulberry32(seed).value;
      const cx = p.x + (random - 0.5) * 0.12;
      const cz = p.z + (0.5 - random) * 0.12;
      const special = random < 0.28;
      switch (theme.id) {
        case 'yard':
          if (special) {
            add('box', cx, top + 0.13, cz, 0.3, 0.26, 0.3, theme.base);
            add('box', cx, top + 0.27, cz, 0.32, 0.025, 0.06, theme.trim);
            add('box', cx, top + 0.14, cz + 0.154, 0.035, 0.24, 0.01, theme.trim);
          } else {
            add('leaf', cx, top + 0.12, cz, 0.24, 0.17, 0.22, theme.leaf);
            add('ball', cx + 0.08, top + 0.27, cz, 0.06, 0.04, 0.06, theme.accent);
            add('ball', cx + 0.08, top + 0.3, cz, 0.025, 0.02, 0.025, theme.trim);
          }
          break;
        case 'grove':
          if (special) {
            add('post', cx, top + 0.23, cz, 0.07, 0.46, 0.07, theme.trim);
            for (const height of [0.12, 0.27, 0.39])
              add('box', cx + 0.035, top + height, cz, 0.075, 0.025, 0.075, theme.base);
            add('leaf', cx, top + 0.49, cz, 0.26, 0.22, 0.25, theme.leaf);
          } else {
            add('leaf', cx, top + 0.08, cz, 0.27, 0.09, 0.22, theme.leaf);
            if (random > 0.75) add('ball', cx, top + 0.16, cz, 0.08, 0.035, 0.08, theme.accent);
          }
          break;
        case 'bubble':
          if (special) {
            add('post', cx, top + 0.04, cz, 0.23, 0.08, 0.23, theme.trim);
            add('ball', cx, top + 0.27, cz, 0.2, 0.2, 0.2, theme.accent);
            add('ball', cx - 0.07, top + 0.35, cz + 0.13, 0.045, 0.045, 0.025, theme.trim);
            add('ring', cx, top + 0.11, cz, 0.26, 0.26, 0.26, theme.trim);
          } else {
            add('leaf', cx, top + 0.09, cz, 0.25, 0.12, 0.23, theme.leaf);
            add('ball', cx, top + 0.25, cz, 0.08, 0.08, 0.08, theme.accent);
          }
          break;
        case 'greenhouse':
          add('box', cx, top + 0.08, cz, 0.48, 0.16, 0.32, theme.accent);
          add('leaf', cx - 0.1, top + 0.2, cz, 0.13, 0.14, 0.13, theme.leaf);
          add('leaf', cx + 0.1, top + 0.2, cz, 0.13, 0.14, 0.13, theme.leaf);
          if (special) {
            for (const offset of [-0.22, 0.22])
              add('box', cx + offset, top + 0.29, cz, 0.025, 0.5, 0.025, theme.trim);
            add('box', cx, top + 0.55, cz, 0.52, 0.025, 0.025, theme.trim);
            add('box', cx, top + 0.42, cz, 0.025, 0.23, 0.025, theme.trim);
          }
          break;
        case 'pond':
          if (random < 0.6) {
            add('post', cx, top + 0.018, cz, 0.21, 0.025, 0.2, theme.leaf);
            if (special) {
              add('ball', cx, top + 0.065, cz, 0.085, 0.05, 0.085, theme.accent);
              add('ball', cx, top + 0.1, cz, 0.03, 0.025, 0.03, theme.trim);
            }
          } else if (random > 0.82) {
            for (const offset of [-0.07, 0.07]) {
              add('post', cx + offset, top + 0.19, cz, 0.016, 0.38, 0.016, theme.leaf);
              add('post', cx + offset, top + 0.37, cz, 0.035, 0.11, 0.035, theme.accent);
            }
          } else add('ring', cx, top + 0.012, cz, 0.26, 0.26, 0.26, theme.trim);
          break;
        case 'terrace':
          if (special) {
            add('post', cx, top + 0.16, cz, 0.045, 0.32, 0.045, theme.base);
            add('box', cx, top + 0.34, cz, 0.5, 0.07, 0.4, theme.accent);
            add('box', cx, top + 0.38, cz, 0.13, 0.014, 0.4, theme.trim);
            add('ball', cx + 0.12, top + 0.42, cz, 0.055, 0.05, 0.055, theme.trim);
          } else {
            add('box', cx, top + 0.08, cz, 0.37, 0.16, 0.37, theme.trim);
            add('leaf', cx, top + 0.24, cz, 0.22, 0.18, 0.22, theme.leaf);
          }
          break;
        case 'royal':
          if (special) {
            add('post', cx, top + 0.08, cz, 0.19, 0.16, 0.19, theme.trim);
            add('post', cx, top + 0.28, cz, 0.11, 0.24, 0.11, theme.trim);
            add('ring', cx, top + 0.18, cz, 0.15, 0.15, 0.15, theme.accent);
            add('ball', cx, top + 0.46, cz, 0.11, 0.11, 0.11, theme.accent);
          } else {
            add('box', cx, top + 0.18, cz, 0.46, 0.36, 0.4, theme.leaf);
            add('box', cx, top + 0.37, cz, 0.4, 0.04, 0.34, theme.blocked);
            if (random > 0.8) add('ball', cx, top + 0.43, cz, 0.05, 0.05, 0.05, theme.accent);
          }
          break;
      }
    }
  }
  const geometries: Record<Shape, () => BufferGeometry> = {
    box: () => new BoxGeometry(1, 1, 1),
    leaf: () => new IcosahedronGeometry(1, 1),
    ball: () => new SphereGeometry(1, 10, 6),
    post: () => new CylinderGeometry(1, 1, 1, 10),
    ring: () => new TorusGeometry(1, 0.035, 4, 24),
  };
  for (const shape of Object.keys(batches) as Shape[]) {
    const entries = batches[shape];
    if (!entries.length) continue;
    const mesh = new InstancedMesh(
      geometries[shape](),
      new MeshToonMaterial({ color: '#FFFFFF', gradientMap: gradient }),
      entries.length,
    );
    mesh.name = `decoration-${shape}`;
    entries.forEach((entry, index) => {
      mesh.setMatrixAt(index, entry.matrix);
      mesh.setColorAt(index, new Color(entry.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shape !== 'ring';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
