import { DirectionalLight, HemisphereLight, PCFShadowMap, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import type { Board } from '../sim/board';
import { boardBox, fitCamera } from './camera';
import { createTiles } from './tiles';

export function createBoardView(
  board: Board,
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
): { dispose: () => void } {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const tiles = createTiles(board);
  scene.add(tiles.group, new HemisphereLight(0xe4eef6, 0x424955, 1.25));
  const light = new DirectionalLight(0xfff3df, 2);
  light.position.set(-4, 8, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const extent = Math.max(board.width, board.height);
  Object.assign(light.shadow.camera, {
    left: -extent,
    right: extent,
    top: extent,
    bottom: -extent,
    near: 0.1,
    far: 40,
  });
  light.shadow.normalBias = 0.025;
  scene.add(light, light.target);
  const box = boardBox(board.width, board.height);

  function resize(): void {
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);
    renderer.render(scene, fitCamera(box, width / height));
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    dispose: () => {
      observer.disconnect();
      tiles.dispose();
      light.shadow.dispose();
      renderer.dispose();
    },
  };
}
