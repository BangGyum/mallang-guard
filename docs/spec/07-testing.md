# 07. 테스트

`npm test`(Vitest)로 돌립니다. sim은 DOM 없이 Node에서 돌아야 하므로 sim 테스트의 environment는 `node`입니다.
**sim 규칙을 바꾸거나 더할 때는 반드시 테스트를 같이 씁니다.** 화면(view/ui)은 순수 함수만 테스트하고, 나머지는 스크린샷으로 확인합니다.

## 1. 테스트 도우미 (tests/helpers.ts)

```ts
/** 작은 테스트용 콘텐츠. 실제 데이터를 바탕으로 일부만 덮어씀 */
export function makeContent(patch?: Partial<RawContent>): ContentDb;

/** 한 줄짜리 테스트 맵: "S......G" 같은 문자열로 스테이지를 만든다 */
export function laneStage(map: string[], spawns: SpawnGroup[], opts?: Partial<StageDef>): StageDef;

/** n틱 진행하고 그동안의 이벤트를 모아 돌려준다 */
export function run(battle: Battle, ticks: number): SimEvent[];

/** 시나리오 JSON 실행. 거부된 명령이 있으면 throw (strict) */
export function runScenario(content: ContentDb, scenario: Scenario, opts?: { maxSec?: number }): ScenarioResult;
```

## 2. 시나리오 형식 (tests/scenarios/*.json)

```json
{
  "stage": "stage-1",
  "expect": { "result": "won", "minLife": 3 },
  "commands": [
    { "atSec": 0,    "type": "deploy", "unitId": "squirrel", "tile": [2, 1], "dir": "left" },
    { "atSec": 13, "type": "skill",  "unitId": "squirrel" },
    { "atSec": 13, "type": "deploy", "unitId": "penguin",  "tile": [5, 2], "dir": "left" }
  ]
}
```

- `type`은 `deploy`, `retreat`, `skill` 세 가지입니다. `retreat`와 `skill`은 `unitId`로 지정하고, 실행기가 배치 중인 uid로 바꿔서 `Command`를 만듭니다.
- 명령은 `secToTicks(atSec)` 틱에 enqueue합니다 (그 틱의 step 1단계에서 적용). 같은 틱의 명령은 파일 순서대로 적용합니다.
- 전투가 끝나거나 `maxSec`(기본 300초)이 지나면 멈추고 `expect`와 비교합니다.

## 3. 골든 시나리오 (tests/scenarios/stage-1-clear.json)

stage-1을 **푸딩 3개를 지키며 클리어**하는 배치 기록입니다. 아래는 출발점이며, T2.5에서 실제로 돌려 보고 다듬습니다.
도토리 계산은 시작 10, 초당 +1, 토리 스킬 +12(20초마다) 기준입니다.

| 시각 | 명령 | 도토리 (후) |
| --- | --- | --- |
| 0s | 토리 (2,1) left | 1 |
| 13s | 토리 스킬 → 펭펭 (5,2) left | 14 |
| 17.5s | 뚜껑곰 (4,2) up | 0 |
| 33.5s | 토리 스킬 → 몽실 (5,1) left | 11 |
| 42.5s | 토실 (5,4) up | 5 |
| 54s | 토리 스킬 → 냥기사 (6,1) down | 15 |
| 60s | 끈끈 (8,2) left | 8 |

- 스킬 명령은 준비되는 시각보다 0.5초 이상 늦게 넣습니다 (토리: 시작 SP 8이라 12초에 준비, 이후 발동 20초 뒤마다 준비).
- 이 시나리오가 실패하면, 먼저 시나리오의 배치를 조정합니다. 그래도 안 되면 데이터 수치를 조정하고 03 문서에 반영합니다.
- 반대로 **아무것도 배치하지 않는 시나리오는 반드시 패배해야 합니다** (`stage-1-idle.json`, expect lost). 난이도가 0이 되는 것을 막는 테스트입니다.

## 4. 필수 테스트 목록

**tests/architecture.test.ts**
- `src/sim/**/*.ts`를 읽어서 다음이 없는지 확인합니다: `from 'three'`, `../view`, `../ui`, `../app`, `window.`, `document.`, `Math.random`, `Date.now`, `new Date`, `performance.`
- `src/core/**`, `src/data/**`에도 `three`와 DOM 사용이 없는지 확인합니다.
- Vite의 `?raw` glob으로 소스 원문을 읽고, 01 문서의 레이어 표에 맞춰 상대 경로 import, re-export, 동적 import, require를 텍스트 기반으로 검사합니다. 허용된 의존성도 통과하는지 확인합니다.

**tests/data.test.ts**
- 실제 콘텐츠가 검증을 통과합니다.
- 모든 스테이지의 경로를 검증합니다. T1.2는 `buildRoute`, T1.3부터는 `createBattle` 성공으로 확인합니다 (해당 함수가 생기는 티켓 순서에 맞춤).
- 잘못된 데이터 케이스마다 검증기가 경로가 들어간 메시지로 실패합니다. 최소한: 없는 스킬 참조, 고지대 유닛 block > 0, 줄 길이 불일치, 비행 적 + 지상 경로.

**tests/sim/grid.test.ts** (core/grid)
- 방향 회전: 오프셋 (1, 0)은 right (1,0), down (0,1), left (−1,0), up (0,−1).
- 오프셋 (1, −1)은 right (1,−1), down (1,1), left (−1,1), up (−1,−1).
- 맵 밖 사거리 타일이 제거됩니다.

**tests/core/rng.test.ts, math.test.ts, assert.test.ts**
- 난수는 고정 시드 벡터, 상태 복원, uint32 상태와 `[0, 1)` 값 범위를 검증합니다.
- 수학 유틸은 경계 제한·보간·실수 좌표 거리, assert는 실패 메시지와 타입 좁히기를 검증합니다.

**tests/sim/path.test.ts**
- stage-1 지상 경로의 꺾이는 점이 (0,1) (4,1) (4,3) (6,3) (6,1) (9,1) (9,3) (10,3)이고, 길이가 16입니다.
- 비행 경로는 직선 1구간이고, 길이는 √(10² + 2²)입니다.
- `dist → 위치` 변환이 구간 경계에서 정확합니다.

**tests/sim/formulas.test.ts**
- 물리: 공격 280 vs 방어 50 → 230. 공격 280 vs 방어 300 → 14 (최소 피해 5%).
- 마법: 공격 420 vs 마저 15 → 357.
- 회복은 최대 HP를 넘지 않습니다.

**tests/sim/dp.test.ts**
- 시작 10, 30틱 뒤 11. 99에서 멈춥니다.
- 후퇴 환급은 내림입니다 (비용 9 → 4).

**tests/sim/deploy.test.ts**
- 거부 이유 6가지(`ended`, `notReady`, `limit`, `noDp`, `badTile`, `occupied`)가 각각 맞게 나옵니다. 검사 순서도 확인합니다 (도토리가 부족하고 칸도 틀리면 `noDp`).
- 성공하면 도토리가 차감되고 `unitDeploy` 이벤트가 나갑니다.
- 후퇴 → cooldown → `redeploySec` 뒤에 ready.
- 일시정지 중 `flush()`로 배치하면 tick이 그대로입니다.

**tests/sim/block.test.ts**
- 저지 1인 유닛 앞에 적 2마리: 첫째는 멈추고 둘째는 통과합니다.
- 유닛을 후퇴시키면 저지된 적이 다시 움직입니다.
- 비행 적은 저지되지 않습니다.
- 유닛 뒤쪽에서 접촉 거리 안에 있는 적(이미 지나간 적)은 저지되지 않습니다.
- `blockAdd` 스킬이 끝나면 가장 나중에 저지된 적이 풀립니다.
- blockCost 2인 적은 저지 1인 유닛에게 저지되지 않습니다.

**tests/sim/targeting.test.ts**
- 저지 중인 적을 먼저 노립니다.
- 그다음은 `remaining`이 가장 작은 적, 동점이면 uid가 작은 적.
- `canHitAir: false`인 유닛은 비행 적을 무시합니다.
- 메딕은 hp 비율이 가장 낮은 아군을 고르고, 다친 아군이 없으면 공격하지 않습니다.

**tests/sim/attack.test.ts**
- 대상이 처음 생긴 틱에 즉시 공격하고, 이후 `atkIntervalTicks`마다 공격합니다.
- 대상이 없으면 쿨다운이 0에 머뭅니다.
- 적은 자신을 저지한 유닛만 공격하고, `atk` 0인 적은 공격하지 않습니다.

**tests/sim/skills.test.ts**
- 충전 방식 3가지가 각각 맞게 차오릅니다 (auto: 초당 1, attack: 공격당 1, hit: 피격당 1).
- `skillReady` 이벤트는 한 번만 나갑니다.
- 수동 스킬: ready가 아니면 `skillNotReady`, 조건이 거짓이면 `noTarget`.
- 자동 스킬(당근 수프): 다친 아군이 없으면 발동하지 않고 기다렸다가, 생기면 발동합니다.
- 지속 스킬은 정확히 `durationSec` 틱 뒤에 끝나고, `sp`가 0이 됩니다. 발동 중에는 충전되지 않습니다.
- **효과 10종 각각 최소 1개씩**: statMul(공격 간격 절반), blockAdd, splash(반경 안 다른 적도 피해), onHitSlow, stunEveryNthHit(3번째마다), gainDp(최대 99 제한 포함), healAllies, pulseDamage(정확히 3회, 간격 15틱), slowAura(범위를 벗어나면 다음 틱에 풀림), pushback(dist 감소 + 저지 해제).

**tests/sim/status.test.ts**
- 둔화는 가장 강한 것만 적용되고, 같은 세기면 시간이 늘어납니다. 상한은 0.8입니다.
- 기절 중에는 이동하지 않고 공격하지 않습니다.

**tests/sim/outcome.test.ts**
- 누수로 푸딩이 0이 되면 즉시 `lost`, 이후 step은 아무것도 하지 않습니다.
- 모든 적을 처리하면 `won`, `battleEnd` 이벤트는 한 번만 나갑니다.
- 웨이브 표시 값이 스폰 시각에 맞게 바뀝니다.

**tests/sim/determinism.test.ts**
- 골든 시나리오를 두 번 돌리면 매 30틱마다의 `hashState`가 전부 같습니다.
- 같은 명령을 "일시정지 중 flush"와 "다음 step"으로 넣은 두 실행은, 같은 틱에 적용되므로 결과 해시가 같습니다.

**tests/scenarios.test.ts**
- `tests/scenarios/*.json`을 전부 돌려서 `expect`를 확인합니다.

**tests/view/camera.test.ts, picking.test.ts** (순수 함수만)
- `fitCamera` 결과에서 보드 AABB 꼭짓점이 전부 safeRect 안에 있습니다. 16:9, 4:3, 21:9 세 비율로 확인합니다.
- `rayPlaneTile`: 화면 중앙 광선이 보드 중앙 근처 타일을 돌려줍니다. 보드 밖은 null입니다.

## 5. 화면 확인 (사람 또는 에이전트)

화면이 바뀌는 티켓은 PR에 스크린샷을 붙입니다. 1920×1080과 844×390(모바일 가로) 두 가지입니다.
가능하면 Playwright로 `npm run dev` 페이지를 열어 캡처합니다. Playwright 도입은 선택 사항이고, devDependency로만 둡니다.
