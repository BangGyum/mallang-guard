import { describe, expect, it } from 'vitest';
import { violations } from './architectureRules';

const sources = import.meta.glob<string>('../src/{core,data,sim}/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('레이어 의존 규칙', () => {
  it('실제 소스 파일을 검사한다', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(sources))('%s', (file, source) => {
    expect(violations(file.replace('../src/', ''), source)).toEqual([]);
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
    expect(violations('sim/systems/example.ts', source)).not.toEqual([]);
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
    expect(violations('sim/example.ts', source)).not.toEqual([]);
  });

  it('core와 data에서도 Three.js와 DOM을 금지한다', () => {
    for (const layer of ['core', 'data']) {
      expect(violations(`${layer}/example.ts`, "import 'three';")).not.toEqual([]);
      expect(violations(`${layer}/example.ts`, 'document.createElement("canvas")')).not.toEqual([]);
    }
    expect(violations('core/example.ts', "import '../data/types';")).not.toEqual([]);
    expect(violations('data/example.ts', "import '../sim/battle';")).not.toEqual([]);
  });

  it('허용된 의존성과 주석·문자열은 통과한다', () => {
    expect(
      violations(
        'sim/systems/example.ts',
        `import type { ContentDb } from '../../data/types.ts';
         import { clamp } from '../../core/math';
         import { value } from '../constants';
         // import 'three'; window.innerWidth; Math.random();
         /* new Date(); document.body; performance.now(); */
         const text = "import 'three'; window.innerWidth; Math.random()";
         const message = \`document.body Date.now()\`;`,
      ),
    ).toEqual([]);
    expect(violations('data/example.ts', "import './units.json'; import '../core/assert';")).toEqual([]);
  });
});
