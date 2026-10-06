import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('../src/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const allowedLayers: Record<string, readonly string[]> = {
  core: ['core'],
  data: ['core', 'data'],
  sim: ['core', 'sim'],
  art: ['core', 'art'],
  view: ['core', 'data', 'sim', 'view'],
  ui: ['core', 'data', 'sim', 'art', 'view', 'ui'],
};

function violations(file: string, source: string): string[] {
  const layer = file.split('/')[0] ?? '';
  const allowed = allowedLayers[layer];
  if (!allowed) return [];

  const errors: string[] = [];
  const modules = /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(modules)) {
    const specifier = match[1] ?? '';
    const target = specifier.startsWith('.')
      ? new URL(specifier, `file:///src/${file}`).pathname.replace(/^\/src\//, '')
      : specifier;
    const targetLayer = target.split('/')[0] ?? '';
    const permitted = specifier.startsWith('.')
      ? allowed.includes(targetLayer) || (layer === 'sim' && /^data\/types(?:\.ts)?$/.test(target))
      : layer === 'view' && /^three(?:\/|$)/.test(specifier);
    if (!permitted) errors.push(`${file}: forbidden import ${specifier}`);
  }

  if (['core', 'data', 'sim', 'art'].includes(layer) && /\b(?:window|document)\b/.test(source)) {
    errors.push(`${file}: DOM usage`);
  }
  if (layer === 'sim') {
    if (/\bMath\s*(?:\.\s*random|\[\s*['"]random['"]\s*\])/.test(source)) {
      errors.push(`${file}: nondeterministic random`);
    }
    if (/\b(?:Date|performance)\b/.test(source)) errors.push(`${file}: wall clock usage`);
  }
  return errors;
}

describe('architecture', () => {
  it('실제 소스의 직접 의존성과 금지된 전역 사용을 검사한다', () => {
    const entries = Object.entries(sources);
    expect(entries.length).toBeGreaterThan(0);
    const errors = entries.flatMap(([path, source]) => violations(path.replace('../src/', ''), source));
    expect(errors).toEqual([]);
  });

  it.each([
    ['core/test.ts', "import { Scene } from 'three';"],
    ['core/test.ts', "import type { UnitDef } from '../data/types';"],
    ['core/test.ts', 'window.innerWidth;'],
    ['data/test.ts', "import { battle } from '../sim/battle';"],
    ['data/test.ts', 'document.createElement("div");'],
    ['sim/test.ts', "import { Scene } from 'three/addons/test';"],
    ['sim/systems/test.ts', "export * from '../../view/camera';"],
    ['sim/test.ts', "import('../ui/hud');"],
    ['sim/test.ts', "require('../app/loop');"],
    ['sim/test.ts', "import units from '../data/units.json';"],
    ['sim/test.ts', 'Math.random();'],
    ['sim/test.ts', 'Math["random"]();'],
    ['sim/test.ts', 'Date.now();'],
    ['sim/test.ts', 'new Date();'],
    ['sim/test.ts', 'performance.now();'],
    ['sim/test.ts', 'window["innerWidth"];'],
    ['sim/test.ts', 'document.createElement("div");'],
    ['art/test.ts', "import { Scene } from 'three';"],
    ['view/test.ts', "import { hud } from '../ui/hud';"],
    ['ui/test.ts', "import { Scene } from 'three';"],
    ['ui/test.ts', "import { loop } from '../app/loop';"],
  ])('%s에서 위반 코드 %s를 차단한다', (file, source) => {
    expect(violations(file, source).length).toBeGreaterThan(0);
  });

  it.each([
    ['core/test.ts', "import { lerp } from './math';"],
    ['data/test.ts', "import type { Tile } from '../core/grid';"],
    ['sim/test.ts', "import type { UnitDef } from '../data/types';"],
    ['sim/test.ts', "import type { UnitDef } from '../data/types.ts';"],
    ['sim/systems/test.ts', "import { clamp } from '../../core/math';"],
    ['art/test.ts', "import { lerp } from '../core/math';"],
    ['view/test.ts', "import { Scene } from 'three';"],
    ['view/test.ts', "import { shader } from 'three/addons/test';"],
    ['ui/test.ts', "import { pick } from '../view/picking';"],
  ])('%s에서 허용된 코드 %s는 통과한다', (file, source) => {
    expect(violations(file, source)).toEqual([]);
  });
});
