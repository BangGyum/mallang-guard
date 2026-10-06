import {
  BoxGeometry,
  type BufferGeometry,
  DataTexture,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Tile } from '../core/grid';
import { mulberry32 } from '../core/rng';
import type { Board, TileKind } from '../sim/board';
import { tileHeight, tileToWorld } from './coords';

const TILE_COLORS: Record<TileKind, string> = {
  ground: '#F3DCA6',
  path: '#F3DCA6',
  high: '#E7E1F7',
  blocked: '#93D47E',
  spawn: '#FFA7B4',
  goal: '#A9D3FF',
};

function addInstances(
  group: Group,
  geometry: BufferGeometry,
  material: Material,
  matrices: readonly Matrix4[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  for (const [index, matrix] of matrices.entries()) mesh.setMatrixAt(index, matrix);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createTiles(board: Board): { group: Group; dispose(): void } {
  const group = new Group();
  const gradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
  gradient.minFilter = NearestFilter;
  gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  const cells: Record<TileKind, Tile[]> = {
    ground: [],
    path: [],
    high: [],
    blocked: [],
    spawn: [],
    goal: [],
  };
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const kind = board.kindAt({ x, y });
      if (kind !== undefined) cells[kind].push({ x, y });
    }
  }
  for (const kind of Object.keys(TILE_COLORS) as TileKind[]) {
    if (cells[kind].length === 0) continue;
    const top = tileHeight(kind);
    const thickness = top + 0.25;
    const matrices = cells[kind].map((tile) => {
      const position = tileToWorld(tile, board.width, board.height, top - thickness / 2);
      return new Matrix4().makeTranslation(position.x, position.y, position.z);
    });
    addInstances(
      group,
      new RoundedBoxGeometry(0.96, thickness, 0.96, 2, 0.06),
      new MeshToonMaterial({ color: TILE_COLORS[kind], gradientMap: gradient }),
      matrices,
    );
  }

  const base = new Mesh(
    new RoundedBoxGeometry(board.width, 0.65, board.height, 2, 0.12),
    new MeshToonMaterial({ color: '#A87F5D', gradientMap: gradient }),
  );
  base.position.y = -0.575;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const bushes: Matrix4[] = [];
  const flowers: Matrix4[] = [];
  const transform = new Object3D();
  for (const tile of cells.blocked) {
    let seed = (Math.imul(tile.x, 73856093) ^ Math.imul(tile.y, 19349663)) >>> 0;
    function random(): number {
      const next = mulberry32(seed);
      seed = next.state;
      return next.value;
    }
    const count = 1 + Math.floor(random() * 2);
    const center = tileToWorld(tile, board.width, board.height, tileHeight('blocked'));
    for (let index = 0; index < count; index++) {
      const radius = 0.15 + random() * 0.07;
      transform.position.set(
        center.x + random() * 0.5 - 0.25,
        center.y + radius * 0.6,
        center.z + random() * 0.5 - 0.25,
      );
      transform.scale.set(radius, radius * 0.8, radius);
      transform.updateMatrix();
      bushes.push(transform.matrix.clone());
      if (random() < 0.3) {
        transform.position.x += radius * 0.4;
        transform.position.y += radius * 0.65;
        transform.scale.setScalar(1);
        transform.updateMatrix();
        flowers.push(transform.matrix.clone());
      }
    }
  }
  if (bushes.length > 0) {
    addInstances(
      group,
      new IcosahedronGeometry(1, 1),
      new MeshToonMaterial({ color: '#5FB45A', gradientMap: gradient }),
      bushes,
    );
  }
  if (flowers.length > 0) {
    addInstances(
      group,
      new SphereGeometry(0.055, 8, 6),
      new MeshToonMaterial({ color: '#FF8FB1', gradientMap: gradient }),
      flowers,
    );
  }
  if (cells.high.length > 0) {
    const highlights = cells.high.map((tile) => {
      const position = tileToWorld(tile, board.width, board.height, 0.51);
      return new Matrix4().makeTranslation(position.x, position.y, position.z + 0.42);
    });
    const mesh = addInstances(
      group,
      new BoxGeometry(0.72, 0.012, 0.025),
      new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6 }),
      highlights,
    );
    mesh.castShadow = false;
  }

  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (object instanceof InstancedMesh) object.dispose();
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      gradient.dispose();
      group.clear();
    },
  };
}
