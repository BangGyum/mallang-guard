import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Board } from '../sim/board';
import { fitCamera } from './camera';
import { createTiles } from './tiles';

export interface BoardView {
  resize(): void;
  render(): void;
  dispose(): void;
}

export function createBoardView(canvas: HTMLCanvasElement, board: Board): BoardView {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene();
  const tiles = createTiles(board);
  scene.add(tiles.group);
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
  return {
    resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera = fitCamera(bounds, width / height);
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      tiles.dispose();
      sunlight.shadow.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
