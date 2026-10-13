import { clamp } from '../core/math';
import type { StageRecord } from '../data/progression';
import { type CollectionState, initialCollection, readCollection, recruitment } from '../data/recruitment';

export const SAVE_KEY = 'mallang-guard:v1';

export interface SaveData {
  version: 1;
  settings: {
    speed: 1 | 2;
    quality: 'high' | 'low';
    sfxVolume: number;
    reducedMotion: boolean | null;
  };
  stages: Record<string, StageRecord>;
  collection: CollectionState;
}

function defaults(unitIds: readonly string[], seed: number): SaveData {
  return {
    version: 1,
    settings: { speed: 1, quality: 'high', sfxVolume: 0.7, reducedMotion: null },
    stages: {},
    collection: initialCollection(unitIds, seed),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadSave(unitIds: readonly string[] = recruitment.pool, seed = 1): SaveData {
  const save = defaults(unitIds, seed);
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!isRecord(raw) || raw.version !== 1) return save;
    save.collection =
      raw.collection === undefined
        ? initialCollection(unitIds, seed, true)
        : readCollection(raw.collection, unitIds, seed);
    if (isRecord(raw.settings)) {
      const settings = raw.settings;
      save.settings.speed = settings.speed === 2 ? 2 : 1;
      save.settings.quality = settings.quality === 'low' ? 'low' : 'high';
      if (typeof settings.sfxVolume === 'number' && Number.isFinite(settings.sfxVolume))
        save.settings.sfxVolume = clamp(settings.sfxVolume, 0, 1);
      if (typeof settings.reducedMotion === 'boolean') save.settings.reducedMotion = settings.reducedMotion;
    }
    if (isRecord(raw.stages))
      for (const [id, stage] of Object.entries(raw.stages))
        if (
          isRecord(stage) &&
          typeof stage.cleared === 'boolean' &&
          typeof stage.bestLife === 'number' &&
          Number.isSafeInteger(stage.bestLife) &&
          stage.bestLife >= 0
        )
          save.stages = { ...save.stages, [id]: { cleared: stage.cleared, bestLife: stage.bestLife } };
  } catch {
    // 저장소가 막혀 있거나 이전 기록이 깨져도 플레이할 수 있습니다.
  }
  return save;
}

export function storeSave(save: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    // 저장 실패는 현재 전투를 중단하지 않습니다.
    return false;
  }
}
