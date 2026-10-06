import {
  BoxGeometry,
  type BufferGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Board, TileKind } from '../sim/board';
import { TILE_HEIGHT, tileCenter } from './coords';

const TILE_COLORS: Record<TileKind, string> = {
  ground: '#687684',
  path: '#596571',
  high: '#a0a9b0',
  blocked: '#35414b',
  spawn: '#d48557',
  goal: '#4da5c0',
};

export function createTiles(board: Board): { group: Group; dispose: () => void } {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const gradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
  gradient.minFilter = NearestFilter;
  gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const transform = new Object3D();
  const tiles = Object.keys(TILE_COLORS) as TileKind[];

  for (const kind of tiles) {
    const positions: [number, number, number][] = [];
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        if (board.kindAt(x, y) === kind) positions.push(tileCenter(x, y, board));
      }
    }
    if (positions.length === 0) continue;
    const thickness = TILE_HEIGHT[kind] + 0.25;
    const geometry = new RoundedBoxGeometry(0.96, thickness, 0.96, 2, 0.04);
    const material = new MeshToonMaterial({ color: TILE_COLORS[kind], gradientMap: gradient });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new InstancedMesh(geometry, material, positions.length);
    for (const [index, [x, top, z]] of positions.entries()) {
      transform.position.set(x, top - thickness / 2, z);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);

    if (kind === 'high' || kind === 'spawn' || kind === 'goal') {
      const markingGeometry = new BoxGeometry(kind === 'high' ? 0.68 : 0.86, 0.014, 0.035);
      const markingMaterial = new MeshBasicMaterial({ color: kind === 'high' ? '#edc76e' : '#e0f4fa' });
      geometries.push(markingGeometry);
      materials.push(markingMaterial);
      const sides = kind === 'high' ? 1 : 4;
      const markings = new InstancedMesh(markingGeometry, markingMaterial, positions.length * sides);
      for (const [index, [x, top, z]] of positions.entries()) {
        for (let side = 0; side < sides; side += 1) {
          const angle = (side * Math.PI) / 2;
          transform.position.set(x + Math.sin(angle) * 0.41, top + 0.007, z + Math.cos(angle) * 0.41);
          transform.rotation.set(0, angle, 0);
          transform.updateMatrix();
          markings.setMatrixAt(index * sides + side, transform.matrix);
        }
      }
      markings.computeBoundingSphere();
      group.add(markings);
    }
  }

  const baseGeometry = new RoundedBoxGeometry(board.width, 0.65, board.height, 2, 0.04);
  const baseMaterial = new MeshToonMaterial({ color: '#1e2833', gradientMap: gradient });
  geometries.push(baseGeometry);
  materials.push(baseMaterial);
  const base = new Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.575;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      gradient.dispose();
    },
  };
}
