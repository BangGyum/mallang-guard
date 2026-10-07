import { assert } from '../../core/assert';
import { dist } from '../../core/math';
import type { ContentDb } from '../../data/types';
import { BLOCK_CONTACT_DIST } from '../constants';
import { unitStats } from '../stats';
import { remaining } from '../targeting';
import type { BattleState, SimEvent, StageRuntime } from '../types';
import { unblock } from './blocking';

export function blockEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  const enemies = [...state.enemies].sort(
    (a, b) => remaining(stage, a) - remaining(stage, b) || a.uid - b.uid,
  );
  for (const unit of state.units) {
    const def = content.units.get(unit.unitId);
    assert(def, 'battle.units: missing definition');
    const capacity = def.deployOn === 'ground' && unit.hp > 0 ? unitStats(content, unit).block : 0;
    let used = unit.blocking.reduce((sum, uid) => {
      const enemy = state.enemies.find((entry) => entry.uid === uid);
      return sum + (enemy ? (content.enemies.get(enemy.enemyId)?.blockCost ?? 0) : 0);
    }, 0);
    for (const uid of [...unit.blocking].reverse()) {
      if (used <= capacity) break;
      const enemy = state.enemies.find((entry) => entry.uid === uid);
      if (enemy) {
        used -= content.enemies.get(enemy.enemyId)?.blockCost ?? 0;
        unblock(state, enemy, events);
      }
    }
    if (capacity < 1) continue;
    for (const enemy of enemies) {
      const enemyDef = content.enemies.get(enemy.enemyId);
      assert(enemyDef, 'battle.enemies: missing definition');
      if (
        enemy.hp <= 0 ||
        enemy.blockedBy !== null ||
        enemyDef.flying ||
        used + enemyDef.blockCost > capacity
      )
        continue;
      const dx = unit.tile.x + 0.5 - enemy.x;
      const dy = unit.tile.y + 0.5 - enemy.y;
      if (dist(0, 0, dx, dy) > BLOCK_CONTACT_DIST) continue;
      const route = stage.routes.get(enemy.routeId);
      const from = route?.points[enemy.segIndex];
      const to = route?.points[enemy.segIndex + 1];
      if (!from || !to || (to.x - from.x) * dx + (to.y - from.y) * dy <= 0) continue;
      enemy.blockedBy = unit.uid;
      unit.blocking.push(enemy.uid);
      used += enemyDef.blockCost;
      events.push({ type: 'block', unit: unit.uid, enemy: enemy.uid });
    }
  }
}
