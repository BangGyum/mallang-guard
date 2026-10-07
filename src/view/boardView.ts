import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  PCFShadowMap,
  type PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import type { BattleState, SimEvent } from '../sim/types';
import { fitCamera } from './camera';
import { createEntityViews } from './entityViews';
import { createHighlights, type HighlightState } from './highlights';
import { createTextures } from './textures';
import { createTiles } from './tiles';

export interface BoardView {
  readonly camera: PerspectiveCamera;
  readonly memory: { geometries: number; textures: number };
  resize(): void;
  render(state: Readonly<BattleState>, alpha: number, dt: number): void;
  onEvents(events: readonly SimEvent[]): void;
  setHighlights(state: HighlightState): void;
  dispose(): void;
}

export function createBoardView(
  canvas: HTMLCanvasElement,
  board: Board,
  content: ContentDb,
  images: ReadonlyMap<string, HTMLCanvasElement>,
): BoardView {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const tiles = createTiles(board);
  const cache = createTextures(images);
  const entities = createEntityViews(content, board, cache.textures);
  const highlights = createHighlights(board, cache.textures, content);
  scene.add(tiles.group);
  scene.add(entities.group);
  scene.add(highlights.group);
  scene.add(new HemisphereLight(0xffffff, 0xb9a7d9, 1));
  const sunlight = new DirectionalLight(0xfff4e0, 2);
  sunlight.position.set(-4, 8, 5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.bias = -0.0001;
  sunlight.shadow.normalBias = 0.02;
  scene.add(sunlight, sunlight.target);

  const bounds = new Box3(
    new Vector3(-board.width / 2, -0.9, -board.height / 2),
    new Vector3(board.width / 2, 1.2, board.height / 2),
  );
  scene.updateMatrixWorld(true);
  sunlight.shadow.updateMatrices(sunlight);
  const shadowBounds = bounds.clone().applyMatrix4(sunlight.shadow.camera.matrixWorldInverse);
  const shadowCamera = sunlight.shadow.camera;
  shadowCamera.left = shadowBounds.min.x - 0.25;
  shadowCamera.right = shadowBounds.max.x + 0.25;
  shadowCamera.bottom = shadowBounds.min.y - 0.25;
  shadowCamera.top = shadowBounds.max.y + 0.25;
  shadowCamera.near = Math.max(0.1, -shadowBounds.max.z - 0.25);
  shadowCamera.far = -shadowBounds.min.z + 0.25;
  shadowCamera.updateProjectionMatrix();

  let camera = fitCamera(bounds, 1);
  let highlightState: HighlightState = {};
  return {
    get memory() {
      return { ...renderer.info.memory };
    },
    get camera() {
      return camera;
    },
    resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera = fitCamera(
        bounds,
        width / height,
        height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
      );
    },
    render(state, alpha, dt) {
      entities.update(state, camera, alpha, dt);
      highlights.update(highlightState, camera);
      renderer.render(scene, camera);
    },
    onEvents(events) {
      entities.onEvents(events);
    },
    setHighlights(state) {
      highlightState = state;
    },
    dispose() {
      tiles.dispose();
      entities.dispose();
      highlights.dispose();
      cache.dispose();
      sunlight.shadow.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
