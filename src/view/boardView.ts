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
import { impactDelays } from './eventTiming';
import { createHighlights, type HighlightState } from './highlights';
import { createLandmarks } from './landmarks';
import { createTextures } from './textures';
import { createTiles } from './tiles';
import { createVfx } from './vfx';

export interface ViewOptions {
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

export interface BoardView {
  readonly camera: PerspectiveCamera;
  readonly memory: { geometries: number; textures: number };
  readonly metrics: { drawCalls: number; particles: number };
  entityPosition(uid: number): Vector3 | undefined;
  setOptions(options: ViewOptions): void;
  resize(): void;
  render(state: Readonly<BattleState>, alpha: number, dt: number): void;
  onEvents(events: readonly SimEvent[], state: Readonly<BattleState>): void;
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
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new Scene();
  const tiles = createTiles(board);
  const cache = createTextures(images);
  const entities = createEntityViews(content, board, cache.textures);
  const highlights = createHighlights(board, cache.textures, content);
  const vfx = createVfx(content, board, cache.textures, entities.position);
  const landmarks = createLandmarks(board, cache.textures);
  landmarks.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  scene.add(tiles.group);
  scene.add(entities.group);
  scene.add(highlights.group);
  scene.add(vfx.group);
  scene.add(landmarks.group);
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
  let quality: 'high' | 'low' = 'high';
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shake = 0;
  return {
    entityPosition: entities.position,
    setOptions(options) {
      quality = options.quality;
      reduced = options.reducedMotion;
      renderer.setPixelRatio(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = quality === 'high';
      renderer.shadowMap.needsUpdate = true;
      entities.setReducedMotion(reduced);
      vfx.setOptions(reduced, quality === 'low');
      landmarks.setReducedMotion(reduced);
    },
    get metrics() {
      return { drawCalls: renderer.info.render.calls, particles: vfx.count };
    },
    get memory() {
      return { ...renderer.info.memory };
    },
    get camera() {
      return camera;
    },
    resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.needsUpdate = true;
      camera = fitCamera(
        bounds,
        width / height,
        height <= 500 ? { minX: -0.94, maxX: 0.94, minY: -0.45, maxY: 0.68 } : undefined,
      );
    },
    render(state, alpha, dt) {
      entities.update(state, camera, alpha, dt);
      vfx.update(state, camera, dt);
      landmarks.update(camera, dt);
      highlights.update(highlightState, camera);
      shake = Math.max(0, shake - dt);
      const offset = reduced ? 0 : Math.sin(shake * 130) * (shake / 0.2) * 0.05;
      camera.position.x += offset;
      renderer.render(scene, camera);
      camera.position.x -= offset;
      camera.updateMatrixWorld();
    },
    onEvents(events, state) {
      const delays = impactDelays(events);
      entities.onEvents(events, state, delays);
      vfx.onEvents(events, state, delays);
      landmarks.onEvents(events);
      if (events.some((event) => event.type === 'enemyLeak')) shake = 0.2;
    },
    setHighlights(state) {
      highlightState = state;
    },
    dispose() {
      tiles.dispose();
      entities.dispose();
      highlights.dispose();
      vfx.dispose();
      landmarks.dispose();
      cache.dispose();
      sunlight.shadow.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
