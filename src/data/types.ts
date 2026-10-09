export type { Dir, Tile } from '../core/grid'; // Dir, Tile은 core/grid.ts에 한 번만 정의
export type DamageType = 'physical' | 'magic' | 'true';
export type DeployOn = 'high';
export type Role =
  | 'vanguard'
  | 'guard'
  | 'defender'
  | 'sniper'
  | 'caster'
  | 'medic'
  | 'specialist'
  | 'supporter';
export type ArtId =
  | 'squirrel'
  | 'cat'
  | 'bear'
  | 'penguin'
  | 'sheep'
  | 'bunny'
  | 'mole'
  | 'snail'
  | 'owl'
  | 'wolf'
  | 'jelly'
  | 'hardJelly'
  | 'crow'
  | 'splitJelly'
  | 'miniJelly'
  | 'spitter'
  | 'kingJelly'
  | 'dashJelly'
  | 'crystalJelly'
  | 'shieldJelly'
  | 'sproutJelly'
  | 'flowerJelly'
  | 'drummerJelly'
  | 'nestJelly'
  | 'armoredCrow'
  | 'pudding';

export interface RangeDef {
  id: string;
  tiles: [number, number][]; // 오른쪽을 볼 때 [dx, dy]. [0,0]은 자기 칸
}

export interface UnitDef {
  id: string;
  name: string; // 표시 이름 (한국어)
  animal: string; // 표시용 동물 이름
  role: Role;
  art: ArtId;
  cost: number;
  deployOn: DeployOn;
  redeploySec: number;
  atk: number;
  atkIntervalSec: number;
  range: string; // RangeDef.id
  damageType: DamageType; // 'true'는 유닛에 쓰지 않음
  canHitAir: boolean;
  traits?: Effect[];
  skill: string; // SkillDef.id
}

export interface EnemyDef {
  id: string;
  name: string;
  art: ArtId;
  hp: number;
  def: number;
  res: number;
  speed: number; // 초당 타일
  flying: boolean;
  lifeDamage: number; // 누수 시 깎는 푸딩 수
  description?: string;
  shieldHp?: number;
  rush?: { intervalSec: number; durationSec: number; speedMul: number };
  regenerate?: { intervalSec: number; amount: number };
  heal?: { intervalSec: number; amount: number; range: number };
  haste?: { range: number; speedMul: number };
  summon?: { intervalSec: number; enemy: string; count: number; maxCasts: number };
  split?: { enemy: string; count: number };
  disrupt?: {
    range: number;
    intervalSec: number;
    durationSec: number;
    atkIntervalMul: number;
    targets: number;
  };
}

export interface SkillDef {
  id: string;
  name: string;
  description: string; // UI에 그대로 표시
  charge: 'auto' | 'attack';
  spCost: number;
  spStart: number;
  trigger: 'manual' | 'auto';
  condition: 'always' | 'enemyInRange';
  durationSec: number; // 0이면 즉시형
  effects: Effect[];
}

export type Effect =
  | { type: 'statMul'; stat: 'atk' | 'atkInterval'; value: number }
  | { type: 'rangeOverride'; range: string }
  | { type: 'multiTarget'; count: number }
  | { type: 'splash'; radius: number }
  | { type: 'onHitSlow'; amount: number; sec: number }
  | { type: 'stunEveryNthHit'; n: number; sec: number }
  | { type: 'gainDp'; value: number }
  | { type: 'hasteAura'; value: number }
  | {
      type: 'pulseDamage';
      count: number;
      intervalSec: number;
      atkMul: number;
      damageType: 'physical' | 'magic';
    }
  | { type: 'slowAura'; amount: number }
  | { type: 'pushback'; tiles: number };

export interface RouteDef {
  from: [number, number];
  via?: [number, number][];
  to: [number, number];
  flying?: boolean;
}

export interface SpawnGroup {
  wave: number; // HUD 표시용 웨이브 번호 (1부터)
  atSec: number;
  enemy: string; // EnemyDef.id
  count: number;
  intervalSec: number; // count가 1이면 0
  route: string; // routes의 키
}

export interface StageDef {
  id: string;
  name: string;
  description?: string;
  map: string[]; // 02 문서 2절의 문자
  startDp: number;
  dpPerSec?: number; // 기본 1
  life: number;
  deployLimit: number;
  roster?: string[]; // 없으면 모든 유닛
  routes: Record<string, RouteDef>;
  spawns: SpawnGroup[];
}

export interface ContentDb {
  units: ReadonlyMap<string, UnitDef>;
  enemies: ReadonlyMap<string, EnemyDef>;
  skills: ReadonlyMap<string, SkillDef>;
  ranges: ReadonlyMap<string, RangeDef>;
  stages: ReadonlyMap<string, StageDef>;
  unitOrder: readonly string[]; // units.json 순서 (UI 정렬 동점 처리용)
}

export interface RawContent {
  units: UnitDef[];
  enemies: EnemyDef[];
  skills: SkillDef[];
  ranges: RangeDef[];
  stages: StageDef[];
}
