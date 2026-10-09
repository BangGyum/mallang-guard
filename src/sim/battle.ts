import type { Dir, Tile } from '../core/grid';
import type { ContentDb } from '../data/types';
import { DEFAULT_SEED } from './constants';
import { checkDeploy, rangeTilesFor, rosterView, unitAt } from './queries';
import { createStage } from './stage';
import { attackEnemies } from './systems/attack';
import { applyCommand } from './systems/commands';
import { removeDead } from './systems/death';
import { updateEnemyAbilities } from './systems/enemyAbilities';
import { updateEnemyMotion } from './systems/enemyMotion';
import { updateEnemySupport } from './systems/enemySupport';
import { moveEnemies } from './systems/movement';
import { checkOutcome } from './systems/outcome';
import { updateRoster } from './systems/roster';
import { updateSkills } from './systems/skills';
import { spawnEnemies } from './systems/spawn';
import { updateStatus } from './systems/status';
import type {
  BattleState,
  Command,
  DeployCheck,
  RosterCardView,
  SimEvent,
  StageRuntime,
  UnitEntity,
} from './types';

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
    for (const cmd of this.#commands) applyCommand(this.content, this.stage, this.#state, cmd, events);
    this.#commands = [];
    return events;
  }

  step(): SimEvent[] {
    if (this.#state.phase !== 'running') return [];
    const events = this.flush();
    updateRoster(this.#state);
    spawnEnemies(this.stage, this.#state, events);
    updateStatus(this.content, this.stage, this.#state, events);
    updateEnemyMotion(this.content, this.#state);
    moveEnemies(this.content, this.stage, this.#state, events);
    if (this.#state.phase === 'running') {
      updateEnemyAbilities(this.content, this.#state, events);
      updateEnemySupport(this.content, this.stage, this.#state, events);
      updateSkills(this.content, this.stage, this.#state, events);
      attackEnemies(this.content, this.stage, this.#state, events);
      removeDead(this.content, this.stage, this.#state, events);
      checkOutcome(this.stage, this.#state, events);
    }
    this.#state.tick += 1;
    return events;
  }

  checkDeploy(unitId: string, tile: Tile): DeployCheck {
    return checkDeploy(this.content, this.stage, this.#state, unitId, tile);
  }

  rangeTilesFor(unitId: string, tile: Tile, dir: Dir): Tile[] {
    const unit = this.unitAt(tile);
    return rangeTilesFor(
      this.content,
      this.stage,
      unitId,
      tile,
      dir,
      unit?.unitId === unitId ? unit.buffs : [],
    );
  }

  unitAt(tile: Tile): Readonly<UnitEntity> | undefined {
    return unitAt(this.#state, tile);
  }

  rosterView(): RosterCardView[] {
    return rosterView(this.content, this.#state);
  }
}

export function createBattle(content: ContentDb, stageId: string, options?: { seed?: number }): Battle {
  return new Battle(content, stageId, options);
}
