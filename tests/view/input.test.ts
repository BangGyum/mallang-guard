import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { hashState } from '../../src/sim/hash';
import { cardDeployReason, directionFromDrag, isCardDrag } from '../../src/ui/inputState';
import { selectionHighlights } from '../../src/ui/selectionHighlights';
import { laneStage, makeContent } from '../helpers';

describe('방향 조준', () => {
  it('28px 아래는 미정이고 주축 방향을 고른다', () => {
    expect(directionFromDrag(27, 0)).toBeNull();
    expect(directionFromDrag(28, 0)).toBe('right');
    expect(directionFromDrag(-40, 20)).toBe('left');
    expect(directionFromDrag(20, -40)).toBe('up');
    expect(directionFromDrag(20, 40)).toBe('down');
  });
});

describe('배치 카드 정보와 드래그 구분', () => {
  it('작은 움직임은 탭으로 유지하고 12px부터 드래그로 처리한다', () => {
    expect(isCardDrag(11, 0)).toBe(false);
    expect(isCardDrag(0, 11)).toBe(false);
    expect(isCardDrag(12, 0)).toBe(true);
    expect(isCardDrag(9, 9)).toBe(true);
    expect(isCardDrag(50, 1, true)).toBe(false);
    expect(isCardDrag(1, 50, true)).toBe(true);
  });
  it('카드 정보 선택은 배치 가능 칸만 표시하고 전투 상태를 변경하지 않는다', () => {
    const stage = laneStage(['S...G', 'HHHHH'], [], { startDp: 99 });
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    const before = hashState(battle.state);
    const highlights = selectionHighlights(battle, { mode: 'preview', unitId: 'squirrel' });
    expect(highlights.available).toHaveLength(5);
    expect(highlights.ghost).toBeUndefined();
    expect(hashState(battle.state)).toBe(before);
    expect(cardDeployReason(battle, 'squirrel')).toBeNull();
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 0, y: 1 }, dir: 'up' });
    battle.flush();
    expect(cardDeployReason(battle, 'squirrel')).toBe('notReady');
    const uid = battle.state.units[0]?.uid;
    if (!uid) throw new Error('유닛 없음');
    expect(selectionHighlights(battle, { mode: 'selected', uid }).hover).toEqual({ x: 0, y: 1 });
  });
  it('도토리가 부족한 카드도 정보 선택 상태를 가질 수 있지만 배치 칸은 표시하지 않는다', () => {
    const stage = laneStage(['S...G', 'HHHHH'], [], { startDp: 10 });
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    expect(cardDeployReason(battle, 'wolf')).toBe('noDp');
    expect(selectionHighlights(battle, { mode: 'preview', unitId: 'wolf' })).toEqual({ available: [] });
    expect(battle.state.units).toEqual([]);
    expect(battle.state.dp).toBe(10);
  });
});
