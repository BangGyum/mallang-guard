import type { Dir, Tile } from '../core/grid';
import type { DamageType, Effect, EnemyDef, StageDef } from '../data/types';
import type { Board } from './board';
import type { Polyline } from './path';

export type { Dir, Tile } from '../core/grid';

export type Command =
  | { type: 'deploy'; unitId: string; tile: Tile; dir: Dir }
  | { type: 'retreat'; uid: number }
  | { type: 'activateSkill'; uid: number };

export type RejectReason =
  | 'ended'
  | 'notReady'
  | 'limit'
  | 'noDp'
  | 'badTile'
  | 'occupied'
  | 'notDeployed'
  | 'skillNotReady'
  | 'noTarget'
  | 'autoSkill';

export type DeployCheck = { ok: true } | { ok: false; reason: RejectReason };

export interface RosterCardView {
  readonly unitId: string;
  readonly state: 'ready' | 'noDp' | 'deployed' | 'cooldown';
  readonly cost: number;
  readonly cooldownSec: number;
  readonly uid: number | null;
}

export interface Ref {
  kind: 'unit' | 'enemy';
  uid: number;
}

export type SimEvent =
  | { type: 'commandRejected'; cmd: Command; reason: RejectReason }
  | { type: 'unitDeploy'; uid: number; unitId: string; tile: Tile; dir: Dir }
  | { type: 'unitRetreat'; uid: number; refund: number }
  | { type: 'unitDisrupt'; src: number; uid: number; untilTick: number }
  | { type: 'enemySpawn'; uid: number; enemyId: string; x: number; y: number; parentUid?: number }
  | { type: 'enemyLeak'; uid: number; lifeLeft: number }
  | { type: 'enemyDie'; uid: number }
  | { type: 'attack'; src: Ref; dst: Ref; damageType: DamageType; ranged: boolean }
  | { type: 'damage'; dst: Ref; amount: number; damageType: DamageType; src: Ref | null }
  | { type: 'status'; enemy: number; kind: 'slow' | 'stun'; on: boolean }
  | { type: 'skillReady'; uid: number }
  | { type: 'skillStart'; uid: number; skillId: string }
  | { type: 'skillPulse'; uid: number }
  | { type: 'skillEnd'; uid: number }
  | { type: 'dpGain'; amount: number; source: 'skill' | 'refund' }
  | { type: 'battleEnd'; result: 'won' | 'lost' };

export interface RosterSlot {
  unitId: string;
  state: 'ready' | 'deployed' | 'cooldown';
  cooldownTicks: number;
  uid: number | null;
}

export type ActiveEffect = Effect;

export interface UnitEntity {
  uid: number;
  unitId: string;
  tile: Tile;
  dir: Dir;
  atkCooldown: number;
  disruptedUntilTick: number;
  disruptionMul: number;
  sp: number;
  skillState: 'charging' | 'ready' | 'active';
  skillEndTick: number;
  skillHitCount: number;
  pulsesLeft: number;
  nextPulseTick: number;
  buffs: ActiveEffect[];
}

export interface EnemyEntity {
  uid: number;
  enemyId: string;
  routeId: string;
  dist: number;
  segIndex: number;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  slowAmount: number;
  slowUntilTick: number;
  stunUntilTick: number;
  abilityCooldown: number;
}

export interface BattleState {
  tick: number;
  phase: 'running' | 'won' | 'lost';
  dp: number;
  dpTicks: number;
  life: number;
  maxLife: number;
  roster: RosterSlot[];
  units: UnitEntity[];
  enemies: EnemyEntity[];
  spawnCursor: number[];
  totalEnemies: number;
  killed: number;
  leaked: number;
  currentWave: number;
  totalWaves: number;
  nextUid: number;
  rngState: number;
}

export interface SpawnRuntime {
  readonly enemy: EnemyDef;
  readonly routeId: string;
  readonly route: Polyline;
  readonly wave: number;
  readonly count: number;
  readonly atTick: number;
  readonly intervalTicks: number;
}

export interface StageRuntime {
  readonly definition: StageDef;
  readonly board: Board;
  readonly routes: ReadonlyMap<string, Polyline>;
  readonly spawns: readonly SpawnRuntime[];
}
