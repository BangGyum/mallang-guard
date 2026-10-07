import { describe, expect, it } from 'vitest';
import { createQualityMonitor } from '../../src/app/quality';

describe('첫 3초 품질 자동 선택', () => {
  it('40fps 미만에서 한 번만 낮은 품질을 선택한다', () => {
    const monitor = createQualityMonitor();
    const samples = Array.from({ length: 120 }, () => monitor.sample(0.1));
    expect(samples.filter(Boolean)).toHaveLength(1);
    expect(samples.slice(0, 29).some(Boolean)).toBe(false);
  });
  it('60fps에서는 품질을 낮추지 않고 측정이 끝난다', () => {
    const monitor = createQualityMonitor();
    for (let i = 0; i < 200; i++) expect(monitor.sample(1 / 60)).toBe(false);
    for (let i = 0; i < 50; i++) expect(monitor.sample(0.1)).toBe(false);
  });
  it('수동 선택 후에는 자동 전환하지 않는다', () => {
    const monitor = createQualityMonitor();
    monitor.sample(0.2);
    monitor.stop();
    for (let i = 0; i < 50; i++) expect(monitor.sample(0.2)).toBe(false);
  });
});
