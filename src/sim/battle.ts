import { assert } from '../core/assert';
import type { ContentDb } from '../data/types';
import { DEFAULT_SEED } from './constants';
import { createStage } from './stage';
import { removeDead } from './systems/death';
import { moveEnemies } from './systems/movement';
import { checkOutcome } from './systems/outcome';
import { spawnEnemies } from './systems/spawn';
import type { BattleState, Command, SimEvent, StageRuntime } from './types';

export class Battle {
  readonly content: ContentDb;
  readonly stage: StageRuntime;
  #state: BattleState;
  #commands: Command[] = [];

  constructor(content: ContentDb, stageId: string, options: { seed?: number } = {}) {
    this.content = content;
    this.stage = createStage(content, stageId);
    const definition = this.stage.definition;
    this.#state = {
      tick: 0,
      phase: 'running',
      dp: definition.startDp,
      dpTicks: 0,
      life: definition.life,
      maxLife: definition.life,
      roster: (definition.roster ?? content.unitOrder).map((unitId) => ({
        unitId,
        state: 'ready',
        cooldownTicks: 0,
        uid: null,
      })),
      units: [],
      enemies: [],
      spawnCursor: this.stage.spawns.map(() => 0),
      totalEnemies: this.stage.spawns.reduce((sum, group) => sum + group.count, 0),
      killed: 0,
      leaked: 0,
      currentWave: 0,
      totalWaves: Math.max(0, ...this.stage.spawns.map((group) => group.wave)),
      nextUid: 1,
      rngState: (options.seed ?? DEFAULT_SEED) >>> 0,
    };
  }

  get state(): Readonly<BattleState> {
    return this.#state;
  }

  enqueue(command: Command): void {
    this.#commands.push(
      command.type === 'deploy' ? { ...command, tile: { ...command.tile } } : { ...command },
    );
  }

  flush(): SimEvent[] {
    const events: SimEvent[] = [];
    for (const cmd of this.#commands) {
      if (this.#state.phase !== 'running') events.push({ type: 'commandRejected', cmd, reason: 'ended' });
      else if (cmd.type === 'deploy') {
        const slot = this.#state.roster.find((entry) => entry.unitId === cmd.unitId);
        // 실제 배치 처리는 T1.4에서 붙인다. 가능한 명령을 성공처럼 버리지 않는다.
        assert(slot?.state !== 'ready', 'battle.commands: deploy handling requires T1.4');
        events.push({ type: 'commandRejected', cmd, reason: 'notReady' });
      } else {
        assert(
          !this.#state.units.some((unit) => unit.uid === cmd.uid),
          'battle.commands: deployed-unit commands are not implemented yet',
        );
        events.push({ type: 'commandRejected', cmd, reason: 'notDeployed' });
      }
    }
    this.#commands = [];
    return events;
  }

  step(): SimEvent[] {
    if (this.#state.phase !== 'running') return [];
    const events = this.flush();
    // 도토리·재배치(T1.4) → 스폰 → 상태(T2.2) → 이동 순서로 확장한다.
    spawnEnemies(this.stage, this.#state, events);
    moveEnemies(this.content, this.stage, this.#state, events);
    if (this.#state.phase === 'running') {
      // 저지·공격(T1.4), 스킬(T2.2) 다음에 사망·승리를 처리한다.
      removeDead(this.content, this.#state, events);
      checkOutcome(this.stage, this.#state, events);
    }
    this.#state.tick += 1;
    return events;
  }
}

export function createBattle(content: ContentDb, stageId: string, options?: { seed?: number }): Battle {
  return new Battle(content, stageId, options);
}
