import { CRITTER_IDS, critterSvg } from '../art/critters';
import { VFX_IDS, vfxSvg } from '../art/vfxArt';
import { bakeSvg } from '../view/textures';

export async function loadArtAssets(): Promise<ReadonlyMap<string, HTMLCanvasElement>> {
  const sources = [
    ...CRITTER_IDS.map((id) => ({ id, svg: critterSvg(id), size: 256 })),
    ...VFX_IDS.map((id) => ({ id, svg: vfxSvg(id), size: 128 })),
  ];
  return new Map(
    await Promise.all(sources.map(async ({ id, svg, size }) => [id, await bakeSvg(svg, size)] as const)),
  );
}
