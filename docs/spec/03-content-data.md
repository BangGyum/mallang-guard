# 03. 콘텐츠 데이터

캐릭터, 적, 스킬, 사거리, 스테이지는 전부 `src/data`의 JSON입니다. 코드에 밸런스 숫자를 쓰지 않습니다.
아래 초기 JSON은 **v0.1의 1차 값**입니다. M4는 이를 유지하고 스테이지 2~6과 새 적 4종을 추가하며, 2026-10-09 요청으로 22×12칸 스테이지 7을 추가했습니다. 현재 수치는 `src/data` JSON, 확장 규칙은 [09-content-expansion.md](09-content-expansion.md)를 따릅니다. 밸런스를 조정해도 되지만, 골든 시나리오 테스트(07 문서)를 통과해야 하고 PR 설명에 바꾼 이유를 적습니다.

## 1. 타입 (src/data/types.ts)

```ts
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
  | 'jelly'
  | 'hardJelly'
  | 'crow'
  | 'splitJelly'
  | 'miniJelly'
  | 'spitter'
  | 'kingJelly'
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
```


`RawContent`는 `units`, `enemies`, `skills`, `ranges`, `stages`의 배열을 가진 테스트·입력 구성용 타입입니다. `validateContent(raw: unknown): ContentDb`는 외부 JSON을 각 필드의 타입부터 검사해 새 객체로 구성합니다. 반환 Map은 타입 수준에서 읽기 전용이며, `unitOrder`는 원본 유닛 순서를 유지합니다.

## 2. 검증 규칙 (src/data/validate.ts)

외부 라이브러리 없이 직접 씁니다. 실패하면 `content/units[3].range: unknown range "longg"` 처럼 **경로가 들어간 메시지**로 throw합니다. T1.1에서는 첫 오류를 표시하고 시작을 중단합니다. `main.ts`는 데이터 모듈을 동적으로 불러와 모듈 초기화 중의 검증 오류도 화면에 표시합니다.

- 원시 객체·배열·문자열·불리언·열거형·좌표 튜플의 형태부터 검사합니다. 숫자는 유한해야 합니다.
- 모든 id는 종류별로 유일해야 합니다.
- 참조가 모두 존재해야 합니다: unit.skill, unit.range, spawn.enemy, spawn.route, stage.roster의 유닛.
- 숫자 범위
  - hp, atkIntervalSec, speed, spCost는 0보다 커야 합니다.
  - atk, def, cost, spStart는 0 이상이고, res는 0~100입니다.
  - `spStart ≤ spCost`
  - 타일·사거리 좌표, wave, count, lifeDamage, life, deployLimit는 정수입니다. wave/count/lifeDamage/life/deployLimit는 1 이상입니다.
  - redeploySec, durationSec, atSec, intervalSec, startDp는 0 이상이며, 지정된 dpPerSec는 양수입니다.
- 유닛
  - `deployOn`은 "high"만 허용합니다. 아군에는 hp/def/res/block이 없고, 적에는 atk/atkIntervalSec/blockCost/damageType이 없습니다.
  - 유닛의 `damageType`은 physical/magic만 허용합니다.
  - `traits`의 타입은 `statMul`, `splash`, `onHitSlow`만 허용합니다.
- 스킬
  - 효과 타입과 필수 필드도 검사합니다. 배율·효과 시간·pulse 간격은 양수, 느려짐은 0~1, hasteAura 배율은 0 초과 1 이하, radius/tiles/DP는 0 이상, 횟수는 정수입니다.
  - pulseDamage는 스킬당 최대 하나이며, 있으면 `durationSec ≥ (count − 1) × intervalSec`이어야 합니다.
  - 즉시형(`durationSec === 0`) 스킬에는 `gainDp`, `pushback`만 있어야 합니다.
  - 지속형 스킬에는 이 두 가지가 없어야 합니다.
- 스테이지
  - 모든 줄의 길이가 같아야 합니다.
  - `from`, `to`, `via`가 맵 안에 있어야 하고, 지상 경로의 `from`은 `S`, `to`는 `G`여야 합니다.
  - 지상 경로는 실제로 경로가 있어야 합니다. 모든 스테이지의 `createBattle` 성공으로 확인합니다 (T1.3). data는 sim을 import하지 않으며, 구조 검증 후 전투 생성 단계에서 경로를 계산합니다.
  - 적이 `flying`이면 그 스폰 그룹의 route는 `flying: true`여야 하고, 반대도 마찬가지입니다.
  - `count ≥ 1`이고, `count > 1`이면 `intervalSec > 0`입니다.
- M4 적 능력
  - 분열 자식은 존재해야 하고 부모와 비행 종류가 같아야 하며 다시 분열할 수 없습니다. `split.count`는 1 이상의 정수입니다.
  - 방해 사거리·주기·지속 시간은 양수, 공격 간격 배율은 1 이상, 대상 수는 1 이상의 정수입니다.

## 3. 초기 데이터

### ranges.json

```json
[
  { "id": "melee", "tiles": [[0,0],[1,0]] },
  { "id": "mid",   "tiles": [[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1],[2,-1],[2,0],[2,1]] },
  { "id": "long",  "tiles": [[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1],[2,-1],[2,0],[2,1],[3,-1],[3,0],[3,1]] }
]
```

### units.json

| id | 이름 | 비용 | 배치 | 공격 | 간격 | 사거리 | 피해 | 대공 | 스킬 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| squirrel | 토리 | 9 | 고지대 | 280 | 1 | mid | physical | X | acornPickup |
| cat | 냥기사 | 14 | 고지대 | 420 | 1.2 | mid | physical | X | nyangCombo |
| bear | 뚜껑곰 | 18 | 고지대 | 220 | 1.2 | mid | physical | X | potLidGuard |
| penguin | 펭펭 | 12 | 고지대 | 380 | 1 | long | physical | O | snowballBarrage |
| sheep | 몽실 | 17 | 고지대 | 420 | 1.6 | mid | magic | O | stardustShower |
| bunny | 토실 | 15 | 고지대 | 260 | 2.85 | long | magic | X | carrotSoup |
| mole | 굴굴 | 8 | 고지대 | 300 | 1 | mid | physical | X | tunnelAmbush |
| snail | 끈끈 | 13 | 고지대 | 200 | 1.9 | mid | magic | O | stickyRoad |

```json
[
  {
    "id": "squirrel",
    "name": "토리",
    "animal": "다람쥐",
    "role": "vanguard",
    "art": "squirrel",
    "cost": 9,
    "deployOn": "high",
    "redeploySec": 30,
    "atk": 280,
    "atkIntervalSec": 1,
    "range": "mid",
    "damageType": "physical",
    "canHitAir": false,
    "skill": "acornPickup"
  },
  {
    "id": "cat",
    "name": "냥기사",
    "animal": "고양이",
    "role": "guard",
    "art": "cat",
    "cost": 14,
    "deployOn": "high",
    "redeploySec": 40,
    "atk": 420,
    "atkIntervalSec": 1.2,
    "range": "mid",
    "damageType": "physical",
    "canHitAir": false,
    "skill": "nyangCombo"
  },
  {
    "id": "bear",
    "name": "뚜껑곰",
    "animal": "곰",
    "role": "defender",
    "art": "bear",
    "cost": 18,
    "deployOn": "high",
    "redeploySec": 50,
    "atk": 220,
    "atkIntervalSec": 1.2,
    "range": "mid",
    "damageType": "physical",
    "canHitAir": false,
    "skill": "potLidGuard"
  },
  {
    "id": "penguin",
    "name": "펭펭",
    "animal": "펭귄",
    "role": "sniper",
    "art": "penguin",
    "cost": 12,
    "deployOn": "high",
    "redeploySec": 40,
    "atk": 380,
    "atkIntervalSec": 1,
    "range": "long",
    "damageType": "physical",
    "canHitAir": true,
    "skill": "snowballBarrage"
  },
  {
    "id": "sheep",
    "name": "몽실",
    "animal": "양",
    "role": "caster",
    "art": "sheep",
    "cost": 17,
    "deployOn": "high",
    "redeploySec": 45,
    "atk": 420,
    "atkIntervalSec": 1.6,
    "range": "mid",
    "damageType": "magic",
    "canHitAir": true,
    "skill": "stardustShower"
  },
  {
    "id": "bunny",
    "name": "토실",
    "animal": "토끼",
    "role": "medic",
    "art": "bunny",
    "cost": 15,
    "deployOn": "high",
    "redeploySec": 45,
    "atk": 260,
    "atkIntervalSec": 2.85,
    "range": "long",
    "damageType": "magic",
    "canHitAir": false,
    "skill": "carrotSoup"
  },
  {
    "id": "mole",
    "name": "굴굴",
    "animal": "두더지",
    "role": "specialist",
    "art": "mole",
    "cost": 8,
    "deployOn": "high",
    "redeploySec": 8,
    "atk": 300,
    "atkIntervalSec": 1,
    "range": "mid",
    "damageType": "physical",
    "canHitAir": false,
    "skill": "tunnelAmbush"
  },
  {
    "id": "snail",
    "name": "끈끈",
    "animal": "달팽이",
    "role": "supporter",
    "art": "snail",
    "cost": 13,
    "deployOn": "high",
    "redeploySec": 45,
    "atk": 200,
    "atkIntervalSec": 1.9,
    "range": "mid",
    "damageType": "magic",
    "canHitAir": true,
    "traits": [
      {
        "type": "onHitSlow",
        "amount": 0.2,
        "sec": 0.8
      }
    ],
    "skill": "stickyRoad"
  }
]
```

### skills.json

```json
[
  {
    "id": "acornPickup",
    "name": "보급 요청",
    "description": "즉시 도토리 +12",
    "charge": "auto",
    "spCost": 20,
    "spStart": 8,
    "trigger": "manual",
    "condition": "always",
    "durationSec": 0,
    "effects": [
      {
        "type": "gainDp",
        "value": 12
      }
    ]
  },
  {
    "id": "nyangCombo",
    "name": "연속 참격",
    "description": "8초 동안 공격 속도 2배, 세 번째 공격마다 0.5초 기절",
    "charge": "attack",
    "spCost": 12,
    "spStart": 0,
    "trigger": "manual",
    "condition": "always",
    "durationSec": 8,
    "effects": [
      {
        "type": "statMul",
        "stat": "atkInterval",
        "value": 0.5
      },
      {
        "type": "stunEveryNthHit",
        "n": 3,
        "sec": 0.5
      }
    ]
  },
  {
    "id": "potLidGuard",
    "name": "충격 제압",
    "description": "10초 동안 공격력 +80%, 공격할 때마다 0.6초 기절",
    "charge": "auto",
    "spCost": 15,
    "spStart": 5,
    "trigger": "manual",
    "condition": "always",
    "durationSec": 10,
    "effects": [
      {
        "type": "statMul",
        "stat": "atk",
        "value": 1.8
      },
      {
        "type": "stunEveryNthHit",
        "n": 1,
        "sec": 0.6
      }
    ]
  },
  {
    "id": "snowballBarrage",
    "name": "냉각탄 포화",
    "description": "15초 동안 공격이 반경 1칸 범위 피해, 맞은 적은 1.5초간 30% 둔화",
    "charge": "auto",
    "spCost": 30,
    "spStart": 10,
    "trigger": "manual",
    "condition": "always",
    "durationSec": 15,
    "effects": [
      {
        "type": "splash",
        "radius": 1
      },
      {
        "type": "onHitSlow",
        "amount": 0.3,
        "sec": 1.5
      }
    ]
  },
  {
    "id": "stardustShower",
    "name": "아크 폭격",
    "description": "사거리 안 모든 적에게 공격력 130% 마법 피해 3회",
    "charge": "auto",
    "spCost": 35,
    "spStart": 15,
    "trigger": "manual",
    "condition": "enemyInRange",
    "durationSec": 1.5,
    "effects": [
      {
        "type": "pulseDamage",
        "count": 3,
        "intervalSec": 0.5,
        "atkMul": 1.3,
        "damageType": "magic"
      }
    ]
  },
  {
    "id": "carrotSoup",
    "name": "전술 가속",
    "description": "8초 동안 사거리 안 친구들의 공격 간격 30% 감소 (자동 발동)",
    "charge": "auto",
    "spCost": 25,
    "spStart": 10,
    "trigger": "auto",
    "condition": "enemyInRange",
    "durationSec": 8,
    "effects": [
      {
        "type": "hasteAura",
        "value": 0.7
      }
    ]
  },
  {
    "id": "tunnelAmbush",
    "name": "돌파 사격",
    "description": "앞의 적 하나를 경로 뒤쪽으로 2칸 밀어냄",
    "charge": "auto",
    "spCost": 10,
    "spStart": 5,
    "trigger": "manual",
    "condition": "enemyInRange",
    "durationSec": 0,
    "effects": [
      {
        "type": "pushback",
        "tiles": 2
      }
    ]
  },
  {
    "id": "stickyRoad",
    "name": "점착탄 지대",
    "description": "12초 동안 사거리 안 적 이동 속도 60% 감소",
    "charge": "auto",
    "spCost": 25,
    "spStart": 8,
    "trigger": "manual",
    "condition": "always",
    "durationSec": 12,
    "effects": [
      {
        "type": "slowAura",
        "amount": 0.6
      }
    ]
  }
]
```

기획 노트에 있던 뚜껑곰의 "도발"은 v0.1에서 뺐습니다. 원거리 적이 없으면 의미가 없기 때문입니다. M4에서 원거리 적을 넣을 때 다시 검토합니다.

### enemies.json

```json
[
  {
    "id": "jelly",
    "name": "말썽젤리",
    "art": "jelly",
    "hp": 600,
    "def": 50,
    "res": 0,
    "speed": 0.9,
    "flying": false,
    "lifeDamage": 1
  },
  {
    "id": "hardJelly",
    "name": "단단젤리",
    "art": "hardJelly",
    "hp": 1500,
    "def": 300,
    "res": 0,
    "speed": 0.6,
    "flying": false,
    "lifeDamage": 1
  },
  {
    "id": "crow",
    "name": "까악",
    "art": "crow",
    "hp": 450,
    "def": 30,
    "res": 0,
    "speed": 1.2,
    "flying": true,
    "lifeDamage": 1
  }
]
```

설계 의도는 이렇습니다. 단단젤리는 방어력이 높아서 물리 공격이 거의 안 들어가므로 몽실(마법)이 필요합니다. 까악은 비행하므로 대공이 되는 친구가 필요합니다.

### stages/stage-1.json

```json
{
  "id": "stage-1",
  "name": "1-1 푸딩 창고 앞마당",
  "map": [
    "##HH###HH##",
    "S....H....#",
    "#HH#.H.#H.#",
    "#HH#...#H.G",
    "####HHH#..#",
    "###########"
  ],
  "startDp": 10,
  "dpPerSec": 1,
  "life": 3,
  "deployLimit": 7,
  "routes": {
    "ground": { "from": [0, 1], "to": [10, 3] },
    "air":    { "from": [0, 1], "to": [10, 3], "flying": true }
  },
  "spawns": [
    { "wave": 1, "atSec": 3,  "enemy": "jelly",     "count": 3, "intervalSec": 3,   "route": "ground" },
    { "wave": 2, "atSec": 20, "enemy": "jelly",     "count": 4, "intervalSec": 2.5, "route": "ground" },
    { "wave": 3, "atSec": 36, "enemy": "crow",      "count": 2, "intervalSec": 4,   "route": "air" },
    { "wave": 3, "atSec": 45, "enemy": "hardJelly", "count": 1, "intervalSec": 0,   "route": "ground" },
    { "wave": 4, "atSec": 56, "enemy": "jelly",     "count": 5, "intervalSec": 2,   "route": "ground" },
    { "wave": 4, "atSec": 62, "enemy": "crow",      "count": 1, "intervalSec": 0,   "route": "air" },
    { "wave": 5, "atSec": 76, "enemy": "hardJelly", "count": 2, "intervalSec": 5,   "route": "ground" },
    { "wave": 5, "atSec": 80, "enemy": "jelly",     "count": 3, "intervalSec": 2,   "route": "ground" }
  ]
}
```

- 적은 모두 21마리입니다.
- 지상 경로는 하나로 정해집니다. 꺾이는 점은 (0,1) → (4,1) → (4,3) → (6,3) → (6,1) → (9,1) → (9,3) → (10,3)이고, 길이는 16타일입니다 (07 문서의 경로 테스트 기대값).
- 이 맵은 기획 노트 목업과 같은 지형입니다.
