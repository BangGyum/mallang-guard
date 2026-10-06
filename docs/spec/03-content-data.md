# 03. 콘텐츠 데이터

캐릭터, 적, 스킬, 사거리, 스테이지는 전부 `src/data`의 JSON입니다. 코드에 밸런스 숫자를 쓰지 않습니다.
아래 수치는 **1차 값**입니다. 밸런스를 조정해도 되지만, 골든 시나리오 테스트(07 문서)를 통과해야 하고 PR 설명에 바꾼 이유를 적습니다.

## 1. 타입 (src/data/types.ts)

```ts
export type { Dir, Tile } from '../core/grid';   // Dir, Tile은 core/grid.ts에 한 번만 정의
export type DamageType = 'physical' | 'magic' | 'true' | 'heal';
export type DeployOn = 'ground' | 'high';
export type Role = 'vanguard' | 'guard' | 'defender' | 'sniper' | 'caster' | 'medic' | 'specialist' | 'supporter';
export type ArtId =
  | 'squirrel' | 'cat' | 'bear' | 'penguin' | 'sheep' | 'bunny' | 'mole' | 'snail'
  | 'jelly' | 'hardJelly' | 'crow' | 'pudding';

export interface RangeDef {
  id: string;
  tiles: [number, number][];      // 오른쪽을 볼 때 [dx, dy]. [0,0]은 자기 칸
}

export interface UnitDef {
  id: string;
  name: string;                   // 표시 이름 (한국어)
  animal: string;                 // 표시용 동물 이름
  role: Role;
  art: ArtId;
  cost: number;
  deployOn: DeployOn;
  redeploySec: number;
  hp: number; atk: number; def: number; res: number;   // res: 0~100
  atkIntervalSec: number;
  block: number;                  // 고지대 유닛은 0
  range: string;                  // RangeDef.id
  damageType: DamageType;         // 'true'는 유닛에 쓰지 않음
  canHitAir: boolean;
  traits?: Effect[];
  skill: string;                  // SkillDef.id
}

export interface EnemyDef {
  id: string;
  name: string;
  art: ArtId;
  hp: number; atk: number; def: number; res: number;
  atkIntervalSec: number;
  speed: number;                  // 초당 타일
  flying: boolean;
  blockCost: number;              // 저지 수를 몇 칸 차지하는지 (기본 1)
  lifeDamage: number;             // 누수 시 깎는 푸딩 수
  damageType: 'physical' | 'magic';
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;            // UI에 그대로 표시
  charge: 'auto' | 'attack' | 'hit';
  spCost: number;
  spStart: number;
  trigger: 'manual' | 'auto';
  condition: 'always' | 'enemyInRange' | 'allyDamagedInRange';
  durationSec: number;            // 0이면 즉시형
  effects: Effect[];
}

export type Effect =
  | { type: 'statMul'; stat: 'atk' | 'def' | 'res' | 'atkInterval'; value: number }
  | { type: 'blockAdd'; value: number }
  | { type: 'splash'; radius: number }
  | { type: 'onHitSlow'; amount: number; sec: number }
  | { type: 'stunEveryNthHit'; n: number; sec: number }
  | { type: 'gainDp'; value: number }
  | { type: 'healAllies'; ratioOfMaxHp: number }
  | { type: 'pulseDamage'; count: number; intervalSec: number; atkMul: number; damageType: 'physical' | 'magic' }
  | { type: 'slowAura'; amount: number }
  | { type: 'pushback'; tiles: number };

export interface RouteDef {
  from: [number, number];
  via?: [number, number][];
  to: [number, number];
  flying?: boolean;
}

export interface SpawnGroup {
  wave: number;                   // HUD 표시용 웨이브 번호 (1부터)
  atSec: number;
  enemy: string;                  // EnemyDef.id
  count: number;
  intervalSec: number;            // count가 1이면 0
  route: string;                  // routes의 키
}

export interface StageDef {
  id: string;
  name: string;
  map: string[];                  // 02 문서 2절의 문자
  startDp: number;
  dpPerSec?: number;              // 기본 1
  life: number;
  deployLimit: number;
  roster?: string[];              // 없으면 모든 유닛
  routes: Record<string, RouteDef>;
  spawns: SpawnGroup[];
}

export interface ContentDb {
  units: ReadonlyMap<string, UnitDef>;
  enemies: ReadonlyMap<string, EnemyDef>;
  skills: ReadonlyMap<string, SkillDef>;
  ranges: ReadonlyMap<string, RangeDef>;
  stages: ReadonlyMap<string, StageDef>;
  unitOrder: readonly string[];   // units.json 순서 (UI 정렬 동점 처리용)
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
  - atk, def, cost, block, spStart는 0 이상이고, res는 0~100입니다.
  - `spStart ≤ spCost`
  - 타일·사거리 좌표, wave, count, block, blockCost, lifeDamage, life, deployLimit는 정수입니다. wave/count/blockCost/lifeDamage/life/deployLimit는 1 이상입니다.
  - redeploySec, durationSec, atSec, intervalSec, startDp는 0 이상이며, 지정된 dpPerSec는 양수입니다.
- 유닛
  - `deployOn: "high"`면 `block === 0`입니다.
  - `damageType`은 `"true"`가 될 수 없습니다.
  - `traits`의 타입은 `statMul`, `splash`, `onHitSlow`만 허용합니다.
- 스킬
  - 효과 타입과 필수 필드도 검사합니다. 배율·효과 시간·pulse 간격은 양수, 느려짐·회복 비율은 0~1, radius/tiles/DP는 0 이상, 횟수는 정수입니다. `blockAdd`는 음수 정수도 허용합니다.
  - pulseDamage가 있으면 `durationSec ≥ (count − 1) × intervalSec`이어야 합니다.
  - 즉시형(`durationSec === 0`) 스킬에는 `gainDp`, `healAllies`, `pushback`만 있어야 합니다.
  - 지속형 스킬에는 이 세 가지가 없어야 합니다.
- 스테이지
  - 모든 줄의 길이가 같아야 합니다.
  - `from`, `to`, `via`가 맵 안에 있어야 하고, 지상 경로의 `from`은 `S`, `to`는 `G`여야 합니다.
  - 지상 경로는 실제로 경로가 있어야 합니다. 모든 스테이지의 `createBattle` 성공으로 확인합니다 (T1.3). data는 sim을 import하지 않으며, 구조 검증 후 전투 생성 단계에서 경로를 계산합니다.
  - 적이 `flying`이면 그 스폰 그룹의 route는 `flying: true`여야 하고, 반대도 마찬가지입니다.
  - `count ≥ 1`이고, `count > 1`이면 `intervalSec > 0`입니다.

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

| id | 이름 | 역할 | 비용 | 배치 | HP | 공격 | 방어 | 마저 | 간격 | 저지 | 사거리 | 피해 | 대공 | 스킬 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| squirrel | 토리 | 선봉 | 9 | 지상 | 1100 | 280 | 150 | 0 | 1.0 | 1 | melee | 물리 | X | acornPickup |
| cat | 냥기사 | 가드 | 14 | 지상 | 1600 | 420 | 220 | 0 | 1.2 | 2 | melee | 물리 | X | nyangCombo |
| bear | 뚜껑곰 | 디펜더 | 18 | 지상 | 2600 | 220 | 300 | 10 | 1.2 | 3 | melee | 물리 | X | potLidGuard |
| penguin | 펭펭 | 스나이퍼 | 12 | 고지대 | 800 | 380 | 60 | 0 | 1.0 | 0 | long | 물리 | O | snowballBarrage |
| sheep | 몽실 | 캐스터 | 17 | 고지대 | 800 | 420 | 50 | 15 | 1.6 | 0 | mid | 마법 | O | stardustShower |
| bunny | 토실 | 메딕 | 15 | 고지대 | 750 | 260 | 40 | 10 | 2.85 | 0 | long | 회복 | X | carrotSoup |
| mole | 굴굴 | 특수 | 8 | 지상 | 900 | 300 | 120 | 0 | 1.0 | 1 | melee | 물리 | X | tunnelAmbush |
| snail | 끈끈 | 서포터 | 13 | 고지대 | 850 | 200 | 50 | 20 | 1.9 | 0 | mid | 마법 | O | stickyRoad |

```json
[
  { "id": "squirrel", "name": "토리", "animal": "다람쥐", "role": "vanguard", "art": "squirrel",
    "cost": 9, "deployOn": "ground", "redeploySec": 30,
    "hp": 1100, "atk": 280, "def": 150, "res": 0, "atkIntervalSec": 1.0,
    "block": 1, "range": "melee", "damageType": "physical", "canHitAir": false, "skill": "acornPickup" },
  { "id": "cat", "name": "냥기사", "animal": "고양이", "role": "guard", "art": "cat",
    "cost": 14, "deployOn": "ground", "redeploySec": 40,
    "hp": 1600, "atk": 420, "def": 220, "res": 0, "atkIntervalSec": 1.2,
    "block": 2, "range": "melee", "damageType": "physical", "canHitAir": false, "skill": "nyangCombo" },
  { "id": "bear", "name": "뚜껑곰", "animal": "곰", "role": "defender", "art": "bear",
    "cost": 18, "deployOn": "ground", "redeploySec": 50,
    "hp": 2600, "atk": 220, "def": 300, "res": 10, "atkIntervalSec": 1.2,
    "block": 3, "range": "melee", "damageType": "physical", "canHitAir": false, "skill": "potLidGuard" },
  { "id": "penguin", "name": "펭펭", "animal": "펭귄", "role": "sniper", "art": "penguin",
    "cost": 12, "deployOn": "high", "redeploySec": 40,
    "hp": 800, "atk": 380, "def": 60, "res": 0, "atkIntervalSec": 1.0,
    "block": 0, "range": "long", "damageType": "physical", "canHitAir": true, "skill": "snowballBarrage" },
  { "id": "sheep", "name": "몽실", "animal": "양", "role": "caster", "art": "sheep",
    "cost": 17, "deployOn": "high", "redeploySec": 45,
    "hp": 800, "atk": 420, "def": 50, "res": 15, "atkIntervalSec": 1.6,
    "block": 0, "range": "mid", "damageType": "magic", "canHitAir": true, "skill": "stardustShower" },
  { "id": "bunny", "name": "토실", "animal": "토끼", "role": "medic", "art": "bunny",
    "cost": 15, "deployOn": "high", "redeploySec": 45,
    "hp": 750, "atk": 260, "def": 40, "res": 10, "atkIntervalSec": 2.85,
    "block": 0, "range": "long", "damageType": "heal", "canHitAir": false, "skill": "carrotSoup" },
  { "id": "mole", "name": "굴굴", "animal": "두더지", "role": "specialist", "art": "mole",
    "cost": 8, "deployOn": "ground", "redeploySec": 8,
    "hp": 900, "atk": 300, "def": 120, "res": 0, "atkIntervalSec": 1.0,
    "block": 1, "range": "melee", "damageType": "physical", "canHitAir": false, "skill": "tunnelAmbush" },
  { "id": "snail", "name": "끈끈", "animal": "달팽이", "role": "supporter", "art": "snail",
    "cost": 13, "deployOn": "high", "redeploySec": 45,
    "hp": 850, "atk": 200, "def": 50, "res": 20, "atkIntervalSec": 1.9,
    "block": 0, "range": "mid", "damageType": "magic", "canHitAir": true,
    "traits": [{ "type": "onHitSlow", "amount": 0.2, "sec": 0.8 }],
    "skill": "stickyRoad" }
]
```

### skills.json

```json
[
  { "id": "acornPickup", "name": "도토리 줍줍", "description": "즉시 도토리 +12",
    "charge": "auto", "spCost": 20, "spStart": 8, "trigger": "manual", "condition": "always",
    "durationSec": 0, "effects": [{ "type": "gainDp", "value": 12 }] },
  { "id": "nyangCombo", "name": "냥냥 연타", "description": "8초 동안 공격 속도 2배, 세 번째 공격마다 0.5초 기절",
    "charge": "attack", "spCost": 12, "spStart": 0, "trigger": "manual", "condition": "always",
    "durationSec": 8, "effects": [
      { "type": "statMul", "stat": "atkInterval", "value": 0.5 },
      { "type": "stunEveryNthHit", "n": 3, "sec": 0.5 } ] },
  { "id": "potLidGuard", "name": "냄비뚜껑 방어", "description": "10초 동안 방어력 +80%, 저지 +1",
    "charge": "hit", "spCost": 15, "spStart": 5, "trigger": "manual", "condition": "always",
    "durationSec": 10, "effects": [
      { "type": "statMul", "stat": "def", "value": 1.8 },
      { "type": "blockAdd", "value": 1 } ] },
  { "id": "snowballBarrage", "name": "눈덩이 폭격", "description": "15초 동안 공격이 반경 1칸 범위 피해, 맞은 적은 1.5초간 30% 둔화",
    "charge": "auto", "spCost": 30, "spStart": 10, "trigger": "manual", "condition": "always",
    "durationSec": 15, "effects": [
      { "type": "splash", "radius": 1 },
      { "type": "onHitSlow", "amount": 0.3, "sec": 1.5 } ] },
  { "id": "stardustShower", "name": "별가루 샤워", "description": "사거리 안 모든 적에게 공격력 130% 마법 피해 3회",
    "charge": "auto", "spCost": 35, "spStart": 15, "trigger": "manual", "condition": "enemyInRange",
    "durationSec": 1.5, "effects": [
      { "type": "pulseDamage", "count": 3, "intervalSec": 0.5, "atkMul": 1.3, "damageType": "magic" } ] },
  { "id": "carrotSoup", "name": "당근 수프", "description": "사거리 안 아군 전원 최대 HP의 30% 회복 (자동 발동)",
    "charge": "auto", "spCost": 25, "spStart": 10, "trigger": "auto", "condition": "allyDamagedInRange",
    "durationSec": 0, "effects": [{ "type": "healAllies", "ratioOfMaxHp": 0.3 }] },
  { "id": "tunnelAmbush", "name": "땅굴 기습", "description": "앞의 적 하나를 경로 뒤쪽으로 2칸 밀어냄",
    "charge": "auto", "spCost": 10, "spStart": 5, "trigger": "manual", "condition": "enemyInRange",
    "durationSec": 0, "effects": [{ "type": "pushback", "tiles": 2 }] },
  { "id": "stickyRoad", "name": "끈적끈적 길", "description": "12초 동안 사거리 안 적 이동 속도 60% 감소",
    "charge": "auto", "spCost": 25, "spStart": 8, "trigger": "manual", "condition": "always",
    "durationSec": 12, "effects": [{ "type": "slowAura", "amount": 0.6 }] }
]
```

기획 노트에 있던 뚜껑곰의 "도발"은 v0.1에서 뺐습니다. 원거리 적이 없으면 의미가 없기 때문입니다. M4에서 원거리 적을 넣을 때 다시 검토합니다.

### enemies.json

```json
[
  { "id": "jelly", "name": "말썽젤리", "art": "jelly",
    "hp": 600, "atk": 260, "def": 50, "res": 0, "atkIntervalSec": 1.7,
    "speed": 0.9, "flying": false, "blockCost": 1, "lifeDamage": 1, "damageType": "physical" },
  { "id": "hardJelly", "name": "단단젤리", "art": "hardJelly",
    "hp": 1500, "atk": 400, "def": 300, "res": 0, "atkIntervalSec": 2.0,
    "speed": 0.6, "flying": false, "blockCost": 1, "lifeDamage": 1, "damageType": "physical" },
  { "id": "crow", "name": "까악", "art": "crow",
    "hp": 450, "atk": 0, "def": 30, "res": 0, "atkIntervalSec": 1.0,
    "speed": 1.2, "flying": true, "blockCost": 1, "lifeDamage": 1, "damageType": "physical" }
]
```

설계 의도는 이렇습니다. 단단젤리는 방어력이 높아서 물리 공격이 거의 안 들어가므로 몽실(마법)이 필요합니다. 까악은 저지할 수 없으므로 대공이 되는 고지대 유닛이 필요합니다.

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
