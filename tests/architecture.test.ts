import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('../src/{core,data,sim}/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const DOM_NAMES =
  /\b(?:window|document|Window|Document|HTMLElement|HTMLCanvasElement|CanvasRenderingContext2D|SVGElement|navigator|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|MutationObserver|ResizeObserver|Image|Audio)\b/;

function scan(source: string): { code: string; imports: string[] } {
  const tokens = Array.from(
    source.matchAll(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|[\w$]+|[^\s]/g,
    ),
    (match) => match[0],
  ).filter((token) => !token.startsWith('//') && !token.startsWith('/*'));
  const imports: string[] = [];
  const code: string[] = [];

  for (const [index, token] of tokens.entries()) {
    if (token.startsWith('`')) {
      for (const expression of token.matchAll(/\$\{([^}]*)\}/g)) {
        const nested = scan(expression[1] ?? '');
        code.push(nested.code);
        imports.push(...nested.imports);
      }
    } else if (token.startsWith("'") || token.startsWith('"')) {
      const previous = tokens[index - 1];
      if (
        previous === 'from' ||
        previous === 'import' ||
        (previous === '(' && tokens[index - 2] === 'import')
      ) {
        imports.push(token.slice(1, -1));
      }
    } else {
      code.push(token);
    }
  }

  return { code: code.join(' '), imports };
}

function resolveImport(file: string, specifier: string): string {
  const parts = file.split('/');
  parts.pop();
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/').replace(/\.ts$/, '');
}

function violations(file: string, source: string): string[] {
  const layer = file.split('/')[1];
  const { code, imports } = scan(source);
  const errors: string[] = [];

  for (const specifier of imports) {
    const target = specifier.startsWith('.') ? resolveImport(file, specifier) : specifier;
    const targetLayer = target.split('/')[1];
    const allowed =
      target.startsWith('src/') &&
      (targetLayer === layer ||
        ((layer === 'data' || layer === 'sim') && targetLayer === 'core') ||
        (layer === 'sim' && target === 'src/data/types'));
    if (!allowed) errors.push(`금지된 import: ${specifier}`);
  }

  if (DOM_NAMES.test(code)) errors.push('DOM API 사용');
  if (layer === 'sim') {
    if (/\bMath\s*(?:\?\s*)?\.\s*random\b/.test(code)) errors.push('Math.random 사용');
    if (/\bDate\b/.test(code)) errors.push('Date 사용');
    if (/\bperformance\b/.test(code)) errors.push('performance 사용');
  }

  return errors;
}

describe('레이어 의존 규칙', () => {
  it('실제 소스 파일을 검사한다', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(sources))('%s', (file, source) => {
    expect(violations(file.replace(/^\.\.\//, ''), source)).toEqual([]);
  });

  it.each([
    ["import { Vector3 } from 'three';"],
    ['import "three/addons/controls/OrbitControls.js";'],
    ['const three = import(\n "three"\n);'],
    ["export { value } from '../../view/boardView';"],
    ["import type { Value }\nfrom '../../ui/controller';"],
    ["import '../../app/app';"],
    ["import { content } from '../../data/index';"],
  ])('sim의 금지 의존성을 잡는다: %s', (source) => {
    expect(violations('src/sim/systems/example.ts', source)).not.toEqual([]);
  });

  it.each([
    ['window . innerWidth'],
    ['document\n. querySelector("canvas")'],
    ['Math\n. random()'],
    ['Date.now()'],
    ['new Date()'],
    ['performance . now()'],
    [`\`\${window.innerWidth}\``],
  ])('sim의 브라우저·비결정적 API를 잡는다: %s', (source) => {
    expect(violations('src/sim/example.ts', source)).not.toEqual([]);
  });

  it('core와 data에서도 Three.js와 DOM을 금지한다', () => {
    for (const layer of ['core', 'data']) {
      expect(violations(`src/${layer}/example.ts`, "import 'three';")).not.toEqual([]);
      expect(violations(`src/${layer}/example.ts`, 'document.createElement("canvas")')).not.toEqual([]);
    }
    expect(violations('src/core/example.ts', "import '../data/types';")).not.toEqual([]);
    expect(violations('src/data/example.ts', "import '../sim/battle';")).not.toEqual([]);
  });

  it('허용된 의존성과 주석·문자열은 통과한다', () => {
    expect(
      violations(
        'src/sim/systems/example.ts',
        `import type { ContentDb } from '../../data/types.ts';
         import { clamp } from '../../core/math';
         import { value } from '../constants';
         // import 'three'; window.innerWidth; Math.random();
         /* new Date(); document.body; performance.now(); */
         const text = "import 'three'; window.innerWidth; Math.random()";
         const message = \`document.body Date.now()\`;`,
      ),
    ).toEqual([]);
    expect(violations('src/data/example.ts', "import './units.json'; import '../core/assert';")).toEqual([]);
  });
});
