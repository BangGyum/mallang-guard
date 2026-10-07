import { describe, expect, it } from 'vitest';
import { directionFromDrag } from '../../src/ui/inputState';

describe('방향 조준', () => {
  it('28px 아래는 미정이고 주축 방향을 고른다', () => {
    expect(directionFromDrag(27, 0)).toBeNull();
    expect(directionFromDrag(28, 0)).toBe('right');
    expect(directionFromDrag(-40, 20)).toBe('left');
    expect(directionFromDrag(20, -40)).toBe('up');
    expect(directionFromDrag(20, 40)).toBe('down');
  });
});
