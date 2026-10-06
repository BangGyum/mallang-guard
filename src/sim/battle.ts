import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { parseBoard } from './board';
import { secToTicks } from './constants';
import { createPath } from './path';
import { removeDeadEnemies } from './systems/death';
import { moveEnemies } from './systems/movement';
import { checkOutcome } from './systems/outcome';
import { spawnEnemies } from './systems/spawn';
import type { BattleState, Command, SimEvent, StageRuntime } from './types';

export interface Battle {
  readonly content: ContentDb;
  readonly stage: StageRuntime;
  readonly state: Readonly<BattleState>;
  enqueue(cmd: Command): void;
  flush(): SimEvent[];
  step(): SimEvent[];
}

export function createBattle(content: ContentDb, stageId: string, opts?: { seed?: number }): Battle {
  const def = content.stages.get(stageId);
  assert(def, `스테이지 ${stageId}가 없습니다`);
  const board = parseBoard(def.map);
  const stage: StageRuntime = {
    id: def.id,
    name: def.name,
    startDp: def.startDp,
    dpPerSec: def.dpPerSec,
    life: def.life,
    deployLimit: def.deployLimit,
    roster: def.roster,
    board,
    routes: new Map(Object.entries(def.routes).map(([id, route]) => [id, createPath(board, route)])),
    spawns: def.spawns.map((group) => ({
      ...group,
      atTick: secToTicks(group.atSec),
      intervalTicks: secToTicks(group.intervalSec),
    })),
    totalWaves: def.spawns.reduce((max, group) => Math.max(max, group.wave), 0),
  };
  const state: BattleState = {
    tick: 0,
    phase: 'running',
    dp: def.startDp,
    dpTicks: 0,
    life: def.life,
    maxLife: def.life,
    roster: (def.roster ?? content.unitOrder).map((unitId) => ({
      unitId,
      state: 'ready',
      cooldownTicks: 0,
      uid: null,
    })),
    units: [],
    enemies: [],
    spawnCursor: def.spawns.map(() => 0),
    totalEnemies: def.spawns.reduce((total, group) => total + group.count, 0),
    killed: 0,
    leaked: 0,
    nextUid: 1,
    rngState: (opts?.seed ?? 1) >>> 0,
    wave: 0,
  };
  const commands: Command[] = [];
  function flush(): SimEvent[] {
    if (commands.length === 0) return [];
    // 명령 처리 시스템은 T1.4에서 연결합니다. 현재는 조용히 명령을 버리지 않습니다.
    if (state.phase === 'running')
      throw new Error('배치·후퇴·스킬 명령 처리는 다음 구현 단계에서 지원합니다');
    return commands.splice(0).map((cmd) => ({ type: 'commandRejected', cmd, reason: 'ended' }));
  }
  return {
    content,
    stage,
    state,
    enqueue(cmd) {
      commands.push(cmd.type === 'deploy' ? { ...cmd, tile: { ...cmd.tile } } : { ...cmd });
    },
    flush,
    step() {
      if (state.phase !== 'running') return [];
      const events = flush();
      spawnEnemies(content, stage, state, events);
      moveEnemies(content, stage, state, events);
      if (state.phase === 'running') {
        removeDeadEnemies(state, events);
        checkOutcome(stage, state, events);
      }
      state.tick++;
      return events;
    },
  };
}
