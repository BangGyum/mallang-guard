# 07. 테스트

## M3 렌더 성능 측정

`node tests/browser/performance.mjs`는 적 60·유닛 8의 1920×1080 실제 GPU 렌더와 빈 rAF 기준을 함께 측정합니다. 표시 주기가 60Hz 미만인 환경에서는 기준 대비 95% 이상을 확인하고, `--uncapped`로 표시 제한 없는 처리량이 60fps 이상인지 별도로 확인합니다. 두 결과를 `docs/verification/t3.3-performance*.json`에 기록합니다. 처리량을 사용자 화면의 실제 fps로 해석하지 않습니다. 드로우콜 120 이하·파티클 200 이하도 검사합니다.

M4 성능 장면은 적 7종을 모두 섞습니다. `MALLANG_SCREENSHOT_PREFIX=t4.1` 기록에서 60Hz 기준 59.75fps, 렌더 CPU p95 1.6ms, 최대 52 draw calls·91 파티클을 확인했습니다. 테스트 환경은 Edge headless·Intel Arc 130V이며 실제 모바일 기기 성능을 대신하지 않습니다.

## M3 브라우저 회귀 검증

개발 서버(127.0.0.1:43195)와 Edge에서 `node tests/browser/<이름>.mjs`로 실행합니다. `MALLANG_SCREENSHOT_PREFIX`를 지정하면 완주·HUD·스킬 팝업·화면 흐름·이펙트·성능 기록을 별도 이름으로 보존합니다. 성능 측정은 다른 브라우저 검증과 동시에 실행하지 않습니다.

| 스크립트 | 확인 내용 |
| --- | --- |
| `art`, `animations`, `effects`, `landmarks` | 그림·상태별 움직임·정지·투사체/사망 동기화·풀 상한·포털/골 |
| `combatArt` | 무장 8종·전용 투사체·좌우 발사 위치·정지 중 연출 고정·전투 상태 보존, PC/모바일 화면과 캐릭터 전체 그림 |
| `characterLifecycle` | 8종 각각의 실제 PC/터치 드래그·방향 선택·자연 충전·수동/자동 스킬 버튼/알림·종료·후퇴·재배치, 총 16회 |
| `battlePreparation` | 실제 stage-1의 10초/3초 시작·준비 중 DP/SP/적 정지와 배치·선택·후퇴, 일시정지·재시작·대기 연장 방지, PC/844×390/740×360의 정보창 고정과 버튼 노출 |
| `audio` | 실제 입력 전 컨텍스트 없음, 9종 합성, 50ms 중복 제한, 음소거, 종료/리스너 정리 |
| `audioTiming` | 도착 전 정지·메뉴/배속 변경·재시작 시 효과음 처리, 종료 징글 시간 동기화 |
| `settings` | PC/터치 설정, 즉시 DPR 변경, 저장/복원, 모션 우선순위, 품질 자동/수동 선택, 재시작 |
| `input`, `inputEdges`, `hud`, `skillPopover` | PC/터치 완주·입력 경계·단축키·수동/자동 스킬·겹침과 리사이즈 |
| `smallPopup`, `pauseOrientation` | 740×360 팝업 버튼 잘림 회귀, 44px 터치 영역, 세로 화면 중 일시정지 |
| `planGaps` | PC·터치의 보드 밖 드래그 그림·취소, HUD·카드·환급의 도토리 그림 |
| `contentExpansion` | PC·터치의 6개 스테이지 선택·잠금, 2/6스테이지 실제 조작 클리어, 별·다음 스테이지·기존 저장 복원 |
| `stageCampaign` | 빈 저장에서 PC·터치 1→6 연속 클리어, 다음 스테이지·별 18개 저장/복원·재도전 패배 시 최고 기록 유지 |
| `resultLayout` | 844×390·740×360에서 별과 결과 버튼이 스크롤 없이 표시되고 44px 터치 영역 유지 |
| `appFlow`, `sessionResources` | PC/모바일 10회 재시작, 이벤트/프레임 정리, GPU 자원 해제 |
| `production` | `npm run preview -- --port 43205`의 `/mallang-guard/`에서 실제 빌드·아트·설정·전투 로딩 |

`npm test`(Vitest)로 돌립니다. sim은 DOM 없이 Node에서 돌아야 하므로 sim 테스트의 environment는 `node`입니다.
**sim 규칙을 바꾸거나 더할 때는 반드시 테스트를 같이 씁니다.** 화면(view/ui)은 순수 함수만 테스트하고, 나머지는 스크린샷으로 확인합니다.

`tests/app/loop.test.ts`는 실제 Battle과 수동 rAF 시각으로 준비 중 명령 처리·DP/SP/틱 정지, 배속/슬로모션 독립성, 정지·탭 가시성·종료 경계와 리스너 정리를 검사합니다. 기존 브라우저의 `enterBattle` 도우미는 기본으로 10초 준비가 끝날 때까지 기다리며, 준비 동작 검사는 `waitForStart: false`를 사용합니다.

## 1. 테스트 도우미 (tests/helpers.ts)

```ts
/** 작은 테스트용 콘텐츠. 실제 데이터를 바탕으로 일부만 덮어씀 */
export function makeContent(patch?: Partial<RawContent>): ContentDb;

/** 한 줄짜리 테스트 맵: "S......G" 같은 문자열로 스테이지를 만든다 */
export function laneStage(map: string[], spawns: SpawnGroup[], opts?: Partial<StageDef>): StageDef;

/** n틱 진행하고 그동안의 이벤트를 모아 돌려준다 */
export function run(battle: Battle, ticks: number): SimEvent[];

/** 시나리오 JSON 실행. 잘못된 명령·시간 초과·기대값 불일치는 throw (strict) */
export function runScenario(content: ContentDb, scenario: Scenario, opts?: {
  maxSec?: number;
  seed?: number;
  commandMode?: 'step' | 'flush';
}): ScenarioResult;
```

`makeContent`, `laneStage`, `run`, `runScenario`는 `tests/helpers.ts`에 구현했습니다. `ScenarioResult`는 종료 상태 `state`, 발생 순서의 `events`, `{ tick, hash }` 배열 `hashes`를 반환합니다. 해시는 초기 상태·매 30틱·마지막 틱에 기록합니다. 기본 seed는 Battle의 기본값 1입니다.

## 2. 시나리오 형식 (tests/scenarios/*.json)

```json
{
  "stage": "stage-1",
  "expect": { "result": "won", "minLife": 3 },
  "commands": [
    { "atSec": 0,    "type": "deploy", "unitId": "squirrel", "tile": [2, 0], "dir": "down" },
    { "atSec": 13, "type": "skill",  "unitId": "squirrel" },
    { "atSec": 13, "type": "deploy", "unitId": "penguin",  "tile": [5, 2], "dir": "left" }
  ]
}
```

- `type`은 `deploy`, `retreat`, `skill` 세 가지입니다. `retreat`와 `skill`은 `unitId`로 지정하고, 실행기가 배치 중인 uid로 바꿔서 `Command`를 만듭니다.
- 명령은 `secToTicks(atSec)` 틱에 enqueue합니다 (그 틱의 step 1단계에서 적용). 같은 틱의 명령은 파일 순서대로 적용합니다.
- 원본을 변경하지 않고 변환된 틱 순으로 정렬합니다. 서로 다른 초가 같은 틱으로 반올림되어도 파일 순서를 유지합니다.
- `retreat`·`skill`의 uid를 찾기 전에 앞선 명령을 `flush()`하여 같은 틱의 배치·후퇴를 반영합니다. 재배치 뒤에는 새 uid를 사용합니다. 이때 시간은 흐르지 않습니다.
- `commandMode: 'flush'`는 남은 명령도 매 틱 진행 전에 `flush()`로 적용합니다. 기본값 `'step'`과 같은 틱에서 비교하여 정지 중 명령 처리의 결정론을 검증합니다.
- 전투가 끝나거나 `maxSec`(기본 300초)의 틱 수만큼 진행하면 멈춥니다. 마지막 허용 틱에서 종료한 경우도 성공할 수 있습니다.
- 거부된 명령, 배치되지 않은 유닛 참조, 시간 초과, 종료 뒤 미실행 명령, 승패·최소 푸딩 기대값 불일치는 오류입니다. 오류에는 스테이지·틱과 원인을 표시합니다. 잘못된 명령 시각과 제한 시간도 거부합니다.

## 3. 골든 시나리오 (tests/scenarios/stage-1-clear.json)

stage-1의 검증된 고지대 배치 기록입니다. 수동 스킬 없이도 푸딩 3개를 지킵니다.

| 시각 | 배치 |
| --- | --- |
| 0s | 토리 (2,0) down |
| 12s | 펭펭 (5,2) left |
| 27s | 토실 (3,0) down |
| 44s | 몽실 (2,2) up |
| 58s | 냥기사 (6,4) up |

- `scenarios.test.ts`는 폴더의 모든 JSON을 실행하고, 기본 배치로 젤리 15·단단젤리 3·까마귀 3마리 처치·누수 0·푸딩 3개를 검증합니다. 기존 `basicClear.test.ts`의 매 틱 상태·이벤트 검사도 유지합니다.
- 토끼의 자동 스킬만 사용한 기본 시나리오는 **2613틱(87.1초)에 승리**하며 종료 시 도토리 30개가 남습니다. 총 5명을 배치하며 배치 제한 7명 이내입니다.
- `stage-1-idle.json`은 배치 없이 **804틱(26.8초)에 세 번째 누수로 패배**합니다. 이때까지 스폰된 적은 6마리입니다.
- `determinism.test.ts`는 모든 스테이지 JSON과 수동 스킬(12초 토리·32초 펭펭)을 추가한 stage-1 클리어 시나리오를 각각 반복 실행하고, 정지 중 flush 처리와도 비교합니다.
- 1차 밸런스 판단: 기본 배치로 수동 스킬 없이 완주하며 무배치는 패배하므로 현 수치를 유지합니다. 다양한 배치의 난이도·캐릭터 간 균형은 이 두 시나리오만으로 확정하지 않습니다.

### M4 확장 시나리오

`stage-2~6-clear.json`은 실제 비용·SP·배치 제한을 지키고 수동 스킬을 사용해 모두 푸딩 3개를 지킵니다. 각 `-idle.json`은 무배치 패배를 확인합니다. 클리어 시 처치 수는 순서대로 24/37/25/38/37이며 분열로 생성된 자식을 포함합니다. 전체 12개 JSON은 골든 결과와 반복 실행/flush 결정론 검사에 자동 포함됩니다.

`tests/sim/expansion.test.ts`는 분열 위치·생성 순서·재분열 금지·누수·승리 대기, 적 방해의 범위·동점·기절·배율 중첩·만료·후퇴를 검사합니다. `tests/progression.test.ts`는 별·순차 해금·기존 기록과 새 적 데이터의 잘못된 참조/수치를 검사합니다. 뷰 테스트는 분열 자식이 부모의 원거리 피격 전에 보이지 않는지 확인합니다.

`tests/sim/stageRoutes.test.ts`는 6개 실제 스테이지의 모든 칸에서 고지대 배치 조건을 확인합니다. 검증용 목숨만 늘린 사본으로 뒤 웨이브까지 전부 이동시켜 지형 통과·맵 이탈·적 수/누수 수·보스 누수 피해·모든 경로의 골 도착을 검사합니다. 원본 수치의 승패는 기존 clear/idle 시나리오로 따로 확인합니다.

`node tests/browser/stageCampaign.mjs`는 저장을 미리 채우지 않고 실제 카드 드래그·스킬 버튼·다음 스테이지로 6개를 순서대로 클리어합니다. PC와 844×390 터치에서 각각 푸딩 3개·누수/거부 명령 0·전체 웨이브 종료를 검사하고, 새로고침 후 별 18개 복원과 재도전 패배 시 기록 보존을 확인합니다. 가상 시계로 진행하는 기능 검사이며 결과는 `docs/verification/t4.2-campaign.json`, 화면은 `t4.2-*`에 저장합니다.

## 4. 필수 테스트 목록

**tests/architecture.test.ts**
- `src/sim/**/*.ts`를 읽어서 다음이 없는지 확인합니다: `from 'three'`, `../view`, `../ui`, `../app`, `window.`, `document.`, `Math.random`, `Date.now`, `new Date`, `performance.`
- `src/core/**`, `src/data/**`에도 `three`와 DOM 사용이 없는지 확인합니다.
- Vite의 `?raw` glob으로 소스 원문을 읽고, 01 문서의 레이어 표에 맞춰 상대 경로 import, re-export, 동적 import, require를 텍스트 기반으로 검사합니다. 허용된 의존성도 통과하는지 확인합니다.

**tests/data.test.ts**
- 실제 콘텐츠가 검증을 통과합니다.
- 모든 스테이지의 경로를 검증합니다. T1.2는 `buildRoute`, T1.3부터는 `createBattle` 성공으로 확인합니다 (해당 함수가 생기는 티켓 순서에 맞춤).
- 잘못된 데이터 케이스마다 검증기가 경로가 들어간 메시지로 실패합니다. 최소한: 없는 스킬 참조, 고지대 외 배치 종류, 줄 길이 불일치, 비행 적 + 지상 경로.

**tests/sim/grid.test.ts** (core/grid)
- 방향 회전: 오프셋 (1, 0)은 right (1,0), down (0,1), left (−1,0), up (0,−1).
- 오프셋 (1, −1)은 right (1,−1), down (1,1), left (−1,1), up (−1,−1).
- 맵 밖 사거리 타일이 제거됩니다.

**tests/core/rng.test.ts, math.test.ts, assert.test.ts**
- 난수는 고정 시드 벡터, 상태 복원, uint32 상태와 `[0, 1)` 값 범위를 검증합니다.
- 수학 유틸은 경계 제한·보간·실수 좌표 거리, assert는 실패 메시지와 타입 좁히기를 검증합니다.

**tests/dataRoutes.test.ts**
- 모든 실제 스테이지의 `createBattle`이 성공하고 모든 지상·비행 런타임 경로를 확인합니다. 구조상 유효해도 끊긴 지상 경로는 전투 생성 시 스테이지·경로명이 있는 오류로 실패합니다.

**tests/sim/path.test.ts**
- stage-1 지상 경로의 꺾이는 점이 (0,1) (4,1) (4,3) (6,3) (6,1) (9,1) (9,3) (10,3)이고, 길이가 16입니다.
- 비행 경로는 직선 1구간이고, 길이는 √(10² + 2²)입니다.
- `dist → 위치` 변환이 구간 경계에서 정확합니다.
- A* 동점 처리, 지형 우회·비연결, 경유점·180° 되돌아가기·중복점, 비행 경유, 경로 양끝 제한과 밀치기 후 캐시 복원을 확인합니다.

**tests/sim/formulas.test.ts**
- 물리: 공격 280 vs 방어 50 → 230. 공격 280 vs 방어 300 → 14 (최소 피해 5%).
- 마법: 공격 420 vs 마저 15 → 357.

**tests/sim/dp.test.ts**
- 시작 10, 30틱 뒤 11. 99에서 멈춥니다.
- 후퇴 환급은 내림입니다 (비용 9 → 4).

**tests/sim/deploy.test.ts**
- 거부 이유 6가지(`ended`, `notReady`, `limit`, `noDp`, `badTile`, `occupied`)가 각각 맞게 나옵니다. 검사 순서도 확인합니다 (도토리가 부족하고 칸도 틀리면 `noDp`).
- 성공하면 도토리가 차감되고 `unitDeploy` 이벤트가 나갑니다.
- 후퇴 → cooldown → `redeploySec` 뒤에 ready.
- 일시정지 중 `flush()`로 배치하면 tick이 그대로입니다.

**tests/sim/defense.test.ts**
- 아군 8종 모두 높은 칸만 허용하며 지상·출발·목표·장식 칸에는 배치할 수 없습니다.
- 아군 엔티티·정의에는 체력·저지 필드가 없습니다. 적은 가까운 친구와 무관하게 길을 따라 이동합니다.
- 범위 밖 적은 친구를 해치지 않고 골로 가며 푸딩만 감소합니다.

**tests/sim/targeting.test.ts**
- `remaining`이 가장 작은 적, 동점이면 uid가 작은 적.
- `canHitAir: false`인 유닛은 비행 적을 무시합니다.
- 사거리 밖 적은 공격하지 않습니다.

**tests/sim/attack.test.ts**
- 대상이 처음 생긴 틱에 즉시 공격하고, 이후 `atkIntervalTicks`마다 공격합니다.
- 대상이 없으면 쿨다운이 0에 머뭅니다.
- 공격·피해의 대상은 적이며 아군 반격·회복 루프가 없습니다.

**tests/sim/basicClear.test.ts**
- 위 3절의 고지대 배치로 21마리 처치·푸딩 3개를 유지합니다. 스킬 사용을 포함한 결정론도 확인합니다.

**tests/sim/skills.test.ts**
- 충전 방식 2가지가 각각 맞게 차오릅니다 (auto: 초당 1, attack: 실제 공격당 1).
- `skillReady` 이벤트는 한 번만 나갑니다.
- 수동 스킬: ready가 아니면 `skillNotReady`, 조건이 거짓이면 `noTarget`.
- 자동 스킬(전술 가속): 적이 사거리 안에 없으면 기다렸다가 들어오면 발동합니다. 범위 안 친구의 공격 간격을 줄입니다.
- 지속 스킬은 정확히 `durationSec` 틱 뒤에 끝나고, `sp`가 0이 됩니다. 발동 중에는 충전되지 않습니다.
- 효과 9종을 모두 확인합니다: statMul, splash, onHitSlow, stunEveryNthHit, gainDp(99 상한), hasteAura(범위 안 아군만), pulseDamage(0/15/30틱·만료 경계), slowAura(범위 이탈·만료), pushback(거리 하한·좌표 갱신).
- 발동 중 후퇴하면 펄스와 버프가 사라지고, 스킬 만료 다음 틱부터 재충전합니다.

**tests/sim/unitLifecycle.test.ts**
- 아군 8종 × 4방향의 배치 비용·기본 공격 주기/피해 종류·자연 충전·스킬 2회 발동/종료·후퇴 환급·재배치 대기 경계·새 uid/SP 초기화를 확인합니다.
- 같은 32가지 조합에서 뒤쪽 적 무시와 대공 가능 여부를 별도로 확인합니다. 총 96개입니다.
- 단독 검사 맵과 오래 살아 있는 느린 적만 사용하며 아군 비용·공격·사거리·SP·스킬·재배치 수치는 원본입니다. 브라우저의 `unitAuditScene.mjs`도 같은 원칙을 따릅니다. 전투 상태를 조작해 스킬을 준비시키지 않습니다.

**tests/view/entityEvents.test.ts**
- 아군 8종 × 4방향에서 배치 이벤트 직후의 무기 끝 좌표가 첫 렌더와 일치하는지 기울어진 카메라로 확인합니다. 배치 낙하·숨쉬기·좌우 반전·빌보드 초기화 누락을 재현합니다.
- 기존 즉시 처치·분열 자식·연속 피격·히트스톱 경계 검사도 유지합니다.

**tests/sim/status.test.ts**
- 둔화는 가장 강한 것만 적용되고, 같은 세기면 시간이 늘어납니다. 상한은 0.8입니다.
- 기절 중에는 이동하지 않고 만료 틱부터 이동합니다.

**tests/sim/outcome.test.ts**
- 누수로 푸딩이 0이 되면 즉시 `lost`, 이후 step은 아무것도 하지 않습니다.
- 모든 적을 처리하면 `won`, `battleEnd` 이벤트는 한 번만 나갑니다.
- 웨이브 표시 값이 스폰 시각에 맞게 바뀝니다.
- 실제 stage-1은 804틱 후 세 번째 누수로 패배하며, 이때 6마리가 스폰됐습니다. 목숨만 22로 늘린 테스트에서 21마리 전원의 이동·누수를 별도로 확인합니다. 빈 적 목록이어도 미래 스폰이 남아 있으면 승리하지 않습니다.


**tests/sim/battle.test.ts, spawn.test.ts, movement.test.ts, death.test.ts, hash.test.ts**
- 초기 상태·원본 콘텐츠 보존·seed·정수 틱 변환, 명령 큐 복사·처리 순서·flush 시간 고정과 종료 후 처리를 확인합니다.
- 스폰 초기값·반올림 일정·동시 그룹 순서·공유 uid, 이전 위치·구간 캐시·지상/비행 이동·둔화·기절 시 이동 조건을 확인합니다.
- 적 처치 순서와 중복 정리 방지를 확인합니다. 아군 재배치 대기는 후퇴로만 발생합니다.
- 동일 시드 idle 전투는 매 틱 상태 해시와 이벤트가 같습니다. 현재 상태의 필드 변경이 해시에 반영됩니다.

**tests/sim/determinism.test.ts**
- 클리어·무배치·수동 스킬 클리어를 같은 시드로 두 번 돌리면 매 30틱과 마지막 틱의 `hashState`, 전체 이벤트·최종 상태가 같습니다.
- 같은 명령을 "일시정지 중 flush"와 "다음 step"으로 넣은 두 실행은, 같은 틱에 적용되므로 해시·이벤트·최종 상태가 같습니다. seed 0도 보존합니다.
- 수동 도토리 지급·눈덩이 스킬과 자동 지원 스킬이 실제 발동했는지 확인합니다.

**tests/scenarios.test.ts**
- `tests/scenarios/*.json`을 전부 돌려서 `expect`를 확인합니다.
- 필수 두 JSON의 존재, 적 종류별 처치·누수·종료 이벤트, 해시 기록 간격과 종료 해시를 확인합니다.

**tests/scenarioRunner.test.ts**
- 같은 틱의 배치·스킬·후퇴, 재배치 uid, 소수 시각 반올림·파일 순서·원본 보존을 확인합니다.
- 거부된 명령·미배치 유닛·시간 제한 경계·미실행 명령·기대값 불일치·잘못된 시각이 조용히 통과하지 않는지 확인합니다.

**tests/view/camera.test.ts, picking.test.ts** (순수 함수만)
- `fitCamera` 결과에서 보드 AABB 꼭짓점이 전부 safeRect 안에 있습니다. 16:9, 4:3, 21:9 세 비율로 확인합니다.
- `rayPlaneTile`: 화면 중앙 광선이 보드 중앙 근처 타일을 돌려줍니다. 보드 밖은 null입니다.

## 5. 화면 확인 (사람 또는 에이전트)

화면이 바뀌는 티켓은 PR에 스크린샷을 붙입니다. 1920×1080과 844×390(모바일 가로) 두 가지입니다.
가능하면 Playwright로 `npm run dev` 페이지를 열어 캡처합니다. Playwright 도입은 선택 사항이고, devDependency로만 둡니다.

`node tests/browser/input.mjs`는 Edge에서 실제 마우스·터치 입력으로 잘못된 칸 거부, 고지대 배치·방향 선택·후퇴·환급·회전 안내·수동 스킬 2종의 발동과 stage-1 완주를 확인하고 스크린샷을 저장합니다. 가상 시계와 100ms 프레임으로 고정 틱을 진행하며 FPS 검증은 아닙니다. `node tests/browser/inputEdges.mjs`는 기본 rAF에서 키보드 확정·Esc 취소·터치 취소·두 손가락 입력·방향 드래그를 확인합니다.

T2.4부터 브라우저 입력 검증은 타이틀의 시작 버튼으로 진입합니다. `input.mjs`는 승리 기록의 저장과 새로고침 후 복원도 확인하며, `MALLANG_SCREENSHOT_PREFIX`로 기존 검증 이미지를 덮어쓰지 않고 새 스크린샷을 남길 수 있습니다.

- `tests/app/save.test.ts`: 기본값, 저장/복원, 깨진 JSON·버전·필드, 다른 설정 보존, 저장소 읽기/쓰기 실패를 검사합니다.
- `node tests/browser/appFlow.mjs`: PC·모바일에서 메뉴·정지 배치·새로고침 없는 재시작과 타이틀 복귀를 확인합니다. 각 10회 반복 후 HUD·다이얼로그·프레임 예약·입력 리스너가 남지 않고 기존 최고 기록을 유지하는지 확인합니다.
- `node tests/browser/sessionResources.mjs`: 유닛과 배치 고스트를 포함한 10개 세션에서 활성 자원 개수가 동일하고, 종료 후 `renderer.info.memory`의 지오메트리·텍스처가 0인지 검사합니다.
- `node tests/browser/pauseOrientation.mjs`: 세로 화면에서 메뉴를 닫아도 전투가 멈추고, 가로 복귀 시 선택한 계속하기/정지 배치 상태를 유지하는지 검사합니다.
