import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSave, SAVE_KEY, storeSave } from '../../src/app/save';

let value: string | null;
beforeEach(() => {
  value = null;
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('설정과 클리어 기록 저장', () => {
  it('기록이 없으면 기본 설정으로 시작하며 반환 객체를 공유하지 않는다', () => {
    const first = loadSave();
    expect(first).toEqual({
      version: 1,
      settings: { speed: 1, quality: 'high', sfxVolume: 0.7, reducedMotion: null },
      stages: {},
    });
    first.settings.speed = 2;
    expect(loadSave().settings.speed).toBe(1);
  });
  it('설정과 스테이지 기록을 지정된 키에 저장하고 다시 읽는다', () => {
    const save = loadSave();
    save.settings = { speed: 2, quality: 'low', sfxVolume: 0.35, reducedMotion: true };
    save.stages['stage-1'] = { cleared: true, bestLife: 3 };
    storeSave(save);
    expect(localStorage.setItem).toHaveBeenCalledWith(SAVE_KEY, JSON.stringify(save));
    expect(loadSave()).toEqual(save);
  });
  it.each(['{', 'null', '[]', '{"version":2}', '{"version":1}'])(
    '깨진 기록이나 이전 형식 %s에서도 기본 설정으로 시작한다',
    (raw) => {
      value = raw;
      expect(loadSave().settings.speed).toBe(1);
      expect(loadSave().stages).toEqual({});
    },
  );
  it('유효한 설정만 읽고 잘못된 스테이지 기록은 제외한다', () => {
    value = JSON.stringify({
      version: 1,
      settings: { speed: 99, quality: 'unknown', sfxVolume: 9, reducedMotion: 'true' },
      stages: {
        good: { cleared: true, bestLife: 3 },
        negative: { cleared: true, bestLife: -1 },
        decimal: { cleared: true, bestLife: 0.5 },
        bad: { cleared: 'true', bestLife: 3 },
      },
    });
    expect(loadSave()).toEqual({
      version: 1,
      settings: { speed: 1, quality: 'high', sfxVolume: 1, reducedMotion: null },
      stages: { good: { cleared: true, bestLife: 3 } },
    });
  });
  it('다른 설정이나 기존 클리어 기록을 잃지 않고 배속을 변경한다', () => {
    value = JSON.stringify({
      version: 1,
      settings: { speed: 1, quality: 'low', sfxVolume: 0, reducedMotion: false },
      stages: { 'stage-1': { cleared: true, bestLife: 3 } },
    });
    const save = loadSave();
    save.settings.speed = 2;
    storeSave(save);
    expect(loadSave()).toEqual({
      ...save,
      settings: { speed: 2, quality: 'low', sfxVolume: 0, reducedMotion: false },
    });
  });
  it('저장소 읽기·쓰기 예외가 전투 시작과 저장을 중단하지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('quota');
      },
    });
    expect(loadSave().settings.speed).toBe(1);
    expect(() => storeSave(loadSave())).not.toThrow();
  });
  it('저장소 자체가 제공되지 않는 환경에서도 동작한다', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadSave().stages).toEqual({});
    expect(() => storeSave(loadSave())).not.toThrow();
  });
});
