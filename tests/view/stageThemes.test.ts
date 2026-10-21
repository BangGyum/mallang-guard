import { type Box3, Color, InstancedMesh, Matrix4, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { stageThemeFor } from '../../src/data/stageThemes';
import { parseBoard } from '../../src/sim/board';
import { createTiles } from '../../src/view/tiles';

describe('스테이지별 시각 테마', () => {
  const stages = [...content.stages.values()];

  it('일곱 원본 스테이지를 서로 다른 테마·색으로 구분하고 검사 맵은 마당으로 표시한다', () => {
    expect(stages).toHaveLength(7);
    for (const field of ['id', 'name', 'floor', 'blocked'] as const)
      expect(new Set(stages.map((stage) => stageThemeFor(stage.id)[field])).size).toBe(7);
    for (const id of [undefined, 'test-stage', 'constructor', '__proto__'])
      expect(stageThemeFor(id)).toBe(stageThemeFor('stage-1'));
  });

  it.each(stages)('$id: 장식이 고지대·출입구·인접 칸을 침범하지 않고 공통 색을 유지한다', (stage) => {
    const originalMap = [...stage.map];
    const board = parseBoard(stage.map);
    const tiles = createTiles(board, stageThemeFor(stage.id));
    const decoration = tiles.group.getObjectByName(`decorations-${stageThemeFor(stage.id).id}`);
    expect(decoration).toBeDefined();
    expect(decoration?.children.length).toBeLessThanOrEqual(5);
    const matrix = new Matrix4();
    const position = new Vector3();
    for (const mesh of decoration?.children ?? []) {
      if (!(mesh instanceof InstancedMesh)) throw new Error('장식은 인스턴스로 묶어야 합니다');
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const x = Math.floor(position.x + board.width / 2);
        const y = Math.floor(position.z + board.height / 2);
        const kind = board.kindAt(x, y);
        const box = mesh.geometry.boundingBox?.clone().applyMatrix4(matrix) as Box3;
        const cx = x + 0.5 - board.width / 2;
        const cz = y + 0.5 - board.height / 2;
        expect(box.min.x).toBeGreaterThanOrEqual(cx - 0.48);
        expect(box.max.x).toBeLessThanOrEqual(cx + 0.48);
        expect(box.min.z).toBeGreaterThanOrEqual(cz - 0.48);
        expect(box.max.z).toBeLessThanOrEqual(cz + 0.48);
        expect(box.max.y).toBeLessThan(1.2);
        if (position.y < 0.02) {
          expect(['ground', 'path']).toContain(kind);
          expect(box.max.y).toBeLessThan(0.02);
        } else expect(kind).toBe('blocked');
      }
    }
    const colors = tiles.group.children.flatMap((mesh) =>
      mesh instanceof Mesh && mesh.material instanceof MeshToonMaterial
        ? [mesh.material.color.getHexString()]
        : [],
    );
    for (const common of ['#E7E1F7', '#FFA7B4', '#A9D3FF'])
      expect(colors).toContain(new Color(common).getHexString());
    expect(stage.map).toEqual(originalMap);
    tiles.dispose();
  });

  it.each(stages)('$id: 장식 배치는 결정론적이고 해제 시 GPU 자원을 한 번씩 정리한다', (stage) => {
    const board = parseBoard(stage.map);
    const first = createTiles(board, stageThemeFor(stage.id));
    const second = createTiles(board, stageThemeFor(stage.id));
    const matrices = (group: typeof first.group) => {
      const values: number[][] = [];
      group.traverse((mesh) => {
        if (mesh instanceof InstancedMesh)
          values.push([...mesh.instanceMatrix.array], [...(mesh.instanceColor?.array ?? [])]);
      });
      return values;
    };
    expect(matrices(first.group)).toEqual(matrices(second.group));
    const disposed: number[] = [];
    first.group.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      const material = mesh.material;
      if (Array.isArray(material)) throw new Error('예상하지 않은 복합 재질');
      for (const resource of [mesh.geometry, material, ...(mesh instanceof InstancedMesh ? [mesh] : [])]) {
        const index = disposed.push(0) - 1;
        resource.addEventListener('dispose', () => {
          disposed[index] = (disposed[index] ?? 0) + 1;
        });
      }
    });
    first.dispose();
    expect(disposed.length).toBeGreaterThan(0);
    expect(disposed.every((count) => count === 1)).toBe(true);
    expect(first.group.children).toHaveLength(0);
    second.dispose();
  });
});
