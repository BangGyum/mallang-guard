import bearReadyUrl from './assets/bearReady.png';
import bunnyAimUrl from './assets/bunnyAim.png';
import catReadyUrl from './assets/catReady.png';
import deerCastUrl from './assets/deerCast.png';
import luaAimUrl from './assets/luaAim.png';
import moleAimUrl from './assets/moleAim.png';
import novaAimUrl from './assets/novaAim.png';
import owlCastUrl from './assets/owlCast.png';
import penguinAimUrl from './assets/penguinAim.png';
import rokeAimUrl from './assets/rokeAim.png';
import sheepCastUrl from './assets/sheepCast.png';
import snailAimUrl from './assets/snailAim.png';
import toriAimUrl from './assets/toriAim.png';
import wolfAimUrl from './assets/wolfAimV2.png';
import wolfIdleUrl from './assets/wolfIdle.png';
import { type CritterId, critterSvg } from './critters';

export const WOLF_AIM_URL = wolfAimUrl;
// 1509×1042 원본의 발(y=1018)을 공통 y=93 앵커에 맞춥니다.
export const WOLF_AIM_RECT = [0, 93 - (1018 / 1509) * 100, 100, (1042 / 1509) * 100] as const;
export const ROKE_AIM_URL = rokeAimUrl;
// 로크도 원본 비율을 유지하고 발(y=1030)을 공통 앵커에 맞춥니다.
export const ROKE_AIM_RECT = [0, 93 - (1030 / 1509) * 100, 100, (1042 / 1509) * 100] as const;

// 1509×1042 원본의 발(y=1031)을 공통 앵커에 맞춥니다.
export const LUA_AIM_URL = luaAimUrl;
export const LUA_AIM_RECT = [0, 93 - (1031 / 1509) * 100, 100, (1042 / 1509) * 100] as const;

export const CHARACTER_IMAGES: Partial<
  Record<CritterId, { url: string; rect: readonly [number, number, number, number] }>
> = {
  deer: { url: deerCastUrl, rect: [0, 93 - (1030 / 1508) * 100, 100, (1043 / 1508) * 100] },
  snail: { url: snailAimUrl, rect: [0, 93 - (1016 / 1509) * 100, 100, (1042 / 1509) * 100] },
  sheep: { url: sheepCastUrl, rect: [0, 93 - (1025 / 1509) * 100, 100, (1042 / 1509) * 100] },
  owl: { url: owlCastUrl, rect: [0, 93 - (1025 / 1509) * 100, 100, (1042 / 1509) * 100] },
  snowLeopard: { url: novaAimUrl, rect: [0, 93 - (1032 / 1509) * 100, 100, (1042 / 1509) * 100] },
  bear: { url: bearReadyUrl, rect: [0, 93 - (1026 / 1509) * 100, 100, (1042 / 1509) * 100] },
  penguin: { url: penguinAimUrl, rect: [0, 93 - (989 / 1508) * 100, 100, (1043 / 1508) * 100] },
  bunny: { url: bunnyAimUrl, rect: [0, 93 - (1034 / 1509) * 100, 100, (1042 / 1509) * 100] },
  squirrel: { url: toriAimUrl, rect: [0, 93 - (1033 / 1509) * 100, 100, (1042 / 1509) * 100] },
  mole: { url: moleAimUrl, rect: [0, 93 - (1008 / 1509) * 100, 100, (1042 / 1509) * 100] },
  cat: { url: catReadyUrl, rect: [0, 93 - (1017 / 1509) * 100, 100, (1042 / 1509) * 100] },
  wolf: { url: WOLF_AIM_URL, rect: WOLF_AIM_RECT },
  redPanda: { url: ROKE_AIM_URL, rect: ROKE_AIM_RECT },
  fox: { url: LUA_AIM_URL, rect: LUA_AIM_RECT },
};

export function characterMarkup(id: CritterId): string {
  const url = id === 'wolf' ? wolfIdleUrl : CHARACTER_IMAGES[id]?.url;
  if (!url) return critterSvg(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256" aria-hidden="true"><image href="${url}" width="100" height="100" /></svg>`;
}
