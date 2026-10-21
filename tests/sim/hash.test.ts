import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { hashState } from '../../src/sim/hash';
import type { BattleState } from '../../src/sim/types';
import { run } from '../helpers';

describe('battle state hash', () => {
  it('동일 시드의 전체 실행에서 매 틱 상태와 이벤트가 동일하다', () => {
    const a = createBattle(content, 'stage-1', { seed: 123 });
    const b = createBattle(content, 'stage-1', { seed: 123 });
    for (let tick = 0; tick < 1000; tick += 1) {
      expect(a.step()).toEqual(b.step());
      expect(hashState(a.state)).toBe(hashState(b.state));
    }
    expect(a.state.phase).toBe('lost');
  });
  it('복사본도 같고 해시 계산은 상태를 변경하지 않는다', () => {
    const battle = createBattle(content, 'stage-1');
    run(battle, 100);
    const copy = structuredClone(battle.state);
    const before = JSON.stringify(battle.state);
    expect(hashState(battle.state)).toMatch(/^[a-f0-9]{8}$/);
    expect(hashState(battle.state)).toBe(hashState(copy));
    expect(JSON.stringify(battle.state)).toBe(before);
  });
  it.each(['tick', 'dp', 'life', 'rngState', 'currentWave', 'nextUid', 'killed', 'leaked'] as const)(
    '%s 필드 변경을 반영한다',
    (field) => {
      const battle = createBattle(content, 'stage-1');
      const changed: BattleState = structuredClone(battle.state);
      changed[field] += 1;
      expect(hashState(changed)).not.toBe(hashState(battle.state));
    },
  );
  it('적 위치·체력·스폰 커서 변경을 반영한다', () => {
    const battle = createBattle(content, 'stage-1');
    run(battle, 100);
    for (const field of ['x', 'hp'] as const) {
      const changed: BattleState = structuredClone(battle.state);
      const enemy = changed.enemies[0];
      if (enemy) enemy[field] += 1;
      expect(hashState(changed)).not.toBe(hashState(battle.state));
    }
    const changed: BattleState = structuredClone(battle.state);
    changed.spawnCursor[0] = 10;
    expect(hashState(changed)).not.toBe(hashState(battle.state));
  });
});
