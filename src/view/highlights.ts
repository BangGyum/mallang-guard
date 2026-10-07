import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  type PerspectiveCamera,
  PlaneGeometry,
  type Texture,
} from 'three';
import type { Dir, Tile } from '../core/grid';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import { tileHeight } from './coords';
import { createSprite } from './sprites';

export interface HighlightState {
  readonly available?: readonly Tile[];
  readonly range?: readonly Tile[];
  readonly hover?: Tile | null;
  readonly ghost?: { readonly unitId: string; readonly tile: Tile; readonly dir: Dir | null };
}

export function createHighlights(board: Board, textures: ReadonlyMap<string, Texture>, content: ContentDb) {
  const group = new Group();
  const geometry = new PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
  const matrix = new Matrix4();
  function layer(color: string, opacity: number) {
    const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new InstancedMesh(geometry, material, board.width * board.height);
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }
  const available = layer('#7BE08E', 0.35);
  const range = layer('#FFC22E', 0.4);
  const hover = layer('#FFFFFF', 0.45);
  let ghost: ReturnType<typeof createSprite> | undefined;
  let ghostId: string | undefined;
  function fill(mesh: InstancedMesh, tiles: readonly Tile[], offset: number) {
    mesh.count = tiles.length;
    for (const [index, tile] of tiles.entries()) {
      matrix.makeTranslation(
        tile.x + 0.5 - board.width / 2,
        tileHeight(board.kindAt(tile.x, tile.y) ?? 'ground') + offset,
        tile.y + 0.5 - board.height / 2,
      );
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    group,
    update(state: HighlightState, camera: PerspectiveCamera) {
      fill(available, state.available ?? [], 0.021);
      fill(range, state.range ?? [], 0.025);
      fill(hover, state.hover ? [state.hover] : [], 0.03);
      if (state.ghost?.unitId !== ghostId) {
        if (ghost) {
          group.remove(ghost.group);
          ghost.dispose();
          ghost = undefined;
        }
        ghostId = state.ghost?.unitId;
        const art = ghostId && content.units.get(ghostId)?.art;
        const texture = art && textures.get(art);
        if (texture) {
          ghost = createSprite(texture, 0.9, false);
          ghost.sprite.material.transparent = true;
          const opacity = ghost.sprite.material.uniforms.uOpacity;
          if (opacity) opacity.value = 0.55;
          ghost.sprite.material.depthWrite = false;
          group.add(ghost.group);
        }
      }
      if (ghost && state.ghost) {
        const tile = state.ghost.tile;
        const height = tileHeight(board.kindAt(tile.x, tile.y) ?? 'ground');
        ghost.sprite.position.set(tile.x + 0.5 - board.width / 2, height, tile.y + 0.5 - board.height / 2);
        ghost.sprite.quaternion.copy(camera.quaternion);
        ghost.sprite.scale.x = state.ghost.dir === 'left' ? -0.9 : 0.9;
        ghost.shadow.position.set(ghost.sprite.position.x, height + 0.012, ghost.sprite.position.z);
      }
    },
    dispose() {
      ghost?.dispose();
      for (const mesh of [available, range, hover]) mesh.material.dispose();
      geometry.dispose();
      group.clear();
    },
  };
}
