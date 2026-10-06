import { expect, it } from 'vitest';
import { assert } from '../../src/core/assert';

it('거짓 조건이면 전달한 메시지로 실패한다', () => {
  expect(() => assert(false, 'invalid content')).toThrow('invalid content');
});

it('참 조건이면 값을 좁혀 후속 코드에서 사용할 수 있다', () => {
  const value: unknown = 'valid';
  assert(typeof value === 'string', 'expected string');
  expect(value.toUpperCase()).toBe('VALID');
});
