export function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected object');
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected array');
  return value;
}

export function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'expected nonempty string');
  return value;
}

export function numeric(value: unknown, path: string, min = 0, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `expected finite number in [${min}, ${max}]`);
  }
  return value;
}

export function positive(value: unknown, path: string): number {
  const result = numeric(value, path);
  if (result === 0) fail(path, 'expected positive number');
  return result;
}

export function integer(value: unknown, path: string, min = 0): number {
  const result = numeric(value, path, min);
  if (!Number.isInteger(result)) fail(path, 'expected integer');
  return result;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected boolean');
  return value;
}

export function choice<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  const result = values.find((candidate) => candidate === value);
  if (result === undefined) fail(path, `expected one of ${values.join(', ')}`);
  return result;
}

export function pair(value: unknown, path: string): [number, number] {
  const items = array(value, path);
  if (items.length !== 2) fail(path, 'expected two coordinates');
  return [integer(items[0], `${path}[0]`, -Infinity), integer(items[1], `${path}[1]`, -Infinity)];
}
