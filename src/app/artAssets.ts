import { CHARACTER_IMAGES } from '../art/characterArt';
import { CRITTER_IDS, type CritterId, critterSvg } from '../art/critters';
import { VFX_IDS, vfxSvg } from '../art/vfxArt';
import { bakeImage, bakeSvg } from '../view/textures';

export async function loadArtAssets(): Promise<ReadonlyMap<string, HTMLCanvasElement>> {
  const sources = [
    ...CRITTER_IDS.map((id) => ({ id, svg: critterSvg(id), size: 256 })),
    ...VFX_IDS.map((id) => ({ id, svg: vfxSvg(id), size: 128 })),
  ];
  return new Map(
    await Promise.all(
      sources.map(async ({ id, svg, size }) => {
        const image = CHARACTER_IMAGES[id as CritterId];
        return [id, image ? await bakeImage(image.url, size, image.rect) : await bakeSvg(svg, size)] as const;
      }),
    ),
  );
}
