import { CanvasTexture, SRGBColorSpace } from 'three';
import { assert } from '../core/assert';

export async function bakeSvg(svg: string, size: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    assert(context, '캐릭터 그림을 그릴 수 없습니다');
    context.drawImage(image, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createTextures(images: ReadonlyMap<string, HTMLCanvasElement>) {
  const textures = new Map<string, CanvasTexture>();
  for (const [id, image] of images) {
    const texture = new CanvasTexture(image);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    textures.set(id, texture);
  }
  return {
    textures,
    dispose() {
      for (const texture of textures.values()) texture.dispose();
      textures.clear();
    },
  };
}
