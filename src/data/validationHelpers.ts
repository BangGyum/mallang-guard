import { assert } from '../core/assert';

export function object(value: unknown, path: string): Record<string, unknown> {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), `${path}: expected object`);
  return value as Record<string, unknown>;
}

export function list<T>(value: unknown, path: string, parse: (entry: unknown, path: string) => T): T[] {
  assert(Array.isArray(value), `${path}: expected array`);
  return (value as unknown[]).map((entry, index) => parse(entry, `${path}[${index}]`));
}

export function text(value: unknown, path: string): string {
  assert(typeof value === 'string' && value.length > 0, `${path}: expected nonempty string`);
  return value;
}

export function number(value: unknown, path: string, min = 0, max = Infinity): number {
  assert(typeof value === 'number' && Number.isFinite(value), `${path}: expected finite number`);
  assert(value >= min && value <= max, `${path}: expected number in [${min}, ${max}]`);
  return value;
}

export function positive(value: unknown, path: string): number {
  const result = number(value, path);
  assert(result > 0, `${path}: must be greater than zero`);
  return result;
}

export function integer(value: unknown, path: string, min = 0): number {
  const result = number(value, path, min);
  assert(Number.isInteger(result), `${path}: expected integer`);
  return result;
}

export function bool(value: unknown, path: string): boolean {
  assert(typeof value === 'boolean', `${path}: expected boolean`);
  return value;
}

export function oneOf<const T extends readonly string[]>(value: unknown, path: string, values: T): T[number] {
  assert(typeof value === 'string' && values.includes(value), `${path}: expected ${values.join(' | ')}`);
  return value as T[number];
}

export function point(value: unknown, path: string): [number, number] {
  const values = list(value, path, (entry, entryPath) => integer(entry, entryPath, -Infinity));
  assert(values.length === 2, `${path}: expected [x, y]`);
  return [values[0] ?? 0, values[1] ?? 0];
}
