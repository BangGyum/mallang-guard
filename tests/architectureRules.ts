import { type ESTree, parseSync, Visitor } from 'vite';

const allowedLayers: Record<string, readonly string[]> = {
  core: ['core'],
  data: ['core', 'data'],
  sim: ['core', 'sim'],
  art: ['core', 'art'],
  view: ['core', 'data', 'sim', 'view'],
  ui: ['core', 'data', 'sim', 'art', 'view', 'ui'],
};

const DOM_NAMES =
  /^(?:window|document|Window|Document|HTMLElement|HTMLCanvasElement|CanvasRenderingContext2D|SVGElement|navigator|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|MutationObserver|ResizeObserver|Image|Audio)$/;

function staticName(node: ESTree.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression') return;
  const { property, computed } = node;
  if (!computed && property.type === 'Identifier') return property.name;
  if (computed && property.type === 'Literal' && typeof property.value === 'string') return property.value;
}

export function violations(file: string, source: string): string[] {
  const layer = file.split('/')[0] ?? '';
  const allowed = allowedLayers[layer];
  if (!allowed) return [];

  const parsed = parseSync(file, source);
  const errors = parsed.errors.map((error) => `${file}: ${error.message}`);

  const checkImport = (node: ESTree.Node | null | undefined): void => {
    if (node?.type !== 'Literal' || typeof node.value !== 'string') return;
    const specifier = node.value;
    const relative = specifier.startsWith('.');
    const target = relative
      ? new URL(specifier, `file:///src/${file}`).pathname.replace(/^\/src\//, '')
      : specifier;
    const permitted = relative
      ? allowed.includes(target.split('/')[0] ?? '') ||
        (layer === 'sim' && /^data\/types(?:\.ts)?$/.test(target))
      : layer === 'view' && /^three(?:\/|$)/.test(specifier);
    if (!permitted) errors.push(`${file}: forbidden import ${specifier}`);
  };

  function checkName(name: string): void {
    if (
      (['core', 'data', 'sim'].includes(layer) && DOM_NAMES.test(name)) ||
      (layer === 'art' && (name === 'window' || name === 'document'))
    ) {
      errors.push(`${file}: DOM usage`);
    }
    if (layer === 'sim' && (name === 'Date' || name === 'performance'))
      errors.push(`${file}: wall clock usage`);
  }

  new Visitor({
    ImportDeclaration: (node) => checkImport(node.source),
    ExportAllDeclaration: (node) => checkImport(node.source),
    ExportNamedDeclaration: (node) => checkImport(node.source),
    ImportExpression: (node) => checkImport(node.source),
    TSImportType: (node) => checkImport(node.source),
    TSExternalModuleReference: (node) => checkImport(node.expression),
    CallExpression(node) {
      if (staticName(node.callee) === 'require') checkImport(node.arguments[0]);
    },
    Identifier: (node) => checkName(node.name),
    MemberExpression(node) {
      const object = staticName(node.object);
      const member = staticName(node);
      if (object === 'globalThis' && node.computed && member) checkName(member);
      if (layer === 'sim' && object === 'Math' && member === 'random')
        errors.push(`${file}: nondeterministic random`);
    },
  }).visit(parsed.program);
  return errors;
}
