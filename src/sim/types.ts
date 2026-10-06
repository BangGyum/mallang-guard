import type { Dir, Tile } from '../core/grid';
import type { DamageType, Effect, SpawnGroup, StageDef } from '../data/types';
import type { Board } from './board';
import type { Path } from './path';

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

export interface Ref {
  kind: 'unit' | 'enemy';
  uid: number;
}

export type SimEvent =
  | { type: 'commandRejected'; cmd: Command; reason: RejectReason }
  | { type: 'unitDeploy'; uid: number; unitId: string; tile: Tile; dir: Dir }
  | { type: 'unitRetreat'; uid: number; refund: number }
  | { type: 'unitDie'; uid: number }
  | { type: 'enemySpawn'; uid: number; enemyId: string }
  | { type: 'enemyLeak'; uid: number; lifeLeft: number }
  | { type: 'enemyDie'; uid: number }
  | { type: 'block'; unit: number; enemy: number }
  | { type: 'unblock'; unit: number; enemy: number }
  | { type: 'attack'; src: Ref; dst: Ref; damageType: DamageType; ranged: boolean }
  | { type: 'damage'; dst: Ref; amount: number; damageType: DamageType; src: Ref | null }
  | { type: 'heal'; dst: Ref; amount: number; src: Ref }
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
  hp: number;
  maxHp: number;
  atkCooldown: number;
  sp: number;
  skillState: 'charging' | 'ready' | 'active';
  skillTicksLeft: number;
  skillHitCount: number;
  pulsesLeft: number;
  nextPulseTick: number;
  blocking: number[];
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
  atkCooldown: number;
  blockedBy: number | null;
  slowAmount: number;
  slowUntilTick: number;
  stunUntilTick: number;
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
  nextUid: number;
  rngState: number;
  wave: number;
}

export interface SpawnRuntime extends SpawnGroup {
  atTick: number;
  intervalTicks: number;
}

export interface StageRuntime extends Omit<StageDef, 'map' | 'routes' | 'spawns'> {
  board: Board;
  routes: ReadonlyMap<string, Path>;
  spawns: readonly SpawnRuntime[];
  totalWaves: number;
}
