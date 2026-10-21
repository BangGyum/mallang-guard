import {
  BoxGeometry,
  type BufferGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Tile } from '../core/grid';
import { type StageTheme, stageThemeFor } from '../data/stageThemes';
import type { Board, TileKind } from '../sim/board';
import { tileHeight, tileToWorld } from './coords';
import { createStageDecorations } from './stageDecorations';

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

export function createTiles(
  board: Board,
  theme: StageTheme = stageThemeFor(),
): { group: Group; dispose(): void } {
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
      const kind = board.kindAt(x, y);
      if (kind !== undefined) cells[kind].push({ x, y });
    }
  }
  const colors = { ...TILE_COLORS, ground: theme.floor, path: theme.floor, blocked: theme.blocked };
  for (const kind of Object.keys(colors) as TileKind[]) {
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
      new MeshToonMaterial({ color: colors[kind], gradientMap: gradient }),
      matrices,
    );
  }

  const base = new Mesh(
    new RoundedBoxGeometry(board.width, 0.65, board.height, 2, 0.12),
    new MeshToonMaterial({ color: theme.base, gradientMap: gradient }),
  );
  base.position.y = -0.575;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  group.add(createStageDecorations(board, theme, gradient));
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
