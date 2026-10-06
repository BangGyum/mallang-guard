# 02. 전투 규칙

모든 규칙은 `src/sim`에 구현합니다. 숫자는 콘텐츠면 `src/data/*.json`, 규칙 상수면 `src/sim/constants.ts`에만 둡니다.
이 문서와 구현이 다르면 버그입니다. 규칙을 바꿔야 하면 같은 PR에서 이 문서도 고칩니다.

## 1. 시간

- 1틱 = 1/30초 (`TICK_RATE = 30`).
- 모든 타이머는 **정수 틱**입니다. 데이터의 초 값은 콘텐츠 로드 시 `secToTicks(sec) = Math.round(sec * TICK_RATE)`로 바꿉니다. 단, 0보다 큰 값은 최소 1틱입니다.
- 배속·일시정지·슬로모션은 sim과 무관합니다 (01 문서 4절).

## 2. 좌표와 맵

- 타일 좌표 `(x, y)`: x는 열(오른쪽이 +), y는 행(화면 아래 = 카메라 쪽이 +). 맵 문자열 첫 줄이 y=0입니다.
- 위치는 타일 단위 실수입니다. 타일 `(x, y)`의 중심은 `(x + 0.5, y + 0.5)`입니다.
- 위치가 속한 타일은 `(Math.floor(px), Math.floor(py))`입니다.

| 문자 | kind | 지상 적 이동 | 배치 |
| --- | --- | --- | --- |
| `.` | `ground` | O | 지상 유닛 (`deployOn: "ground"`) |
| `,` | `path` | O | X |
| `H` | `high` | X | 고지대 유닛 (`deployOn: "high"`) |
| `#` | `blocked` | X | X |
| `S` | `spawn` | O | X |
| `G` | `goal` | O | X |

- 모든 줄의 길이는 같아야 합니다 (검증기에서 확인).
- 지상 이동은 상하좌우 4방향만 허용합니다.

## 3. 경로

스테이지의 `routes`는 `{ from, via?, to, flying? }` 형식입니다. 전투 시작 때 한 번 계산해 `StageRuntime.routes`에 저장합니다.

**지상 경로** (`flying`이 없거나 false)
1. `from → via[0] → … → to` 각 구간마다 A*로 타일 경로를 구합니다.
   - 이동 가능 칸: `ground`, `path`, `spawn`, `goal`
   - 4방향, 비용 1, 휴리스틱은 맨해튼 거리
   - 이웃 탐색 순서는 항상 right(+x), down(+y), left(−x), up(−y)
   - 동점이면 f가 작은 것, 그다음 h가 작은 것, 그다음 먼저 열린 노드
2. 구간 경로를 이어 붙이고 이어지는 지점의 중복 타일을 제거합니다.
3. 타일 중심점으로 바꾼 뒤, 일직선 위의 중간 점을 지워 꺾이는 점만 남깁니다. 이것이 폴리라인입니다.
4. 경로를 못 찾으면 `createBattle`이 throw합니다. 데이터 검증 테스트가 이 경우를 잡습니다.

**비행 경로** (`flying: true`): `from`, `via…`, `to` 타일의 중심을 직선으로 잇습니다. 지형은 무시합니다.

**공통**
- 폴리라인마다 누적 길이 배열과 총 길이 `length`를 둡니다.
- 적의 위치는 `dist`(출발점부터 이동한 거리)로 정하고, `remaining = length - dist`입니다.
- `dist → (x, y)` 변환은 적마다 현재 구간 인덱스를 캐시해서 빠르게 합니다.


**경로 API (T1.2)**

```ts
findTilePath(board: Board, from: Tile, to: Tile): Tile[];
buildRoute(board: Board, route: RouteDef): Polyline;
createPolyline(points: readonly Readonly<Tile>[]): Polyline;

interface Polyline {
  readonly points: readonly Readonly<Tile>[];  // 타일 중심의 실수 좌표
  readonly cumulativeLengths: readonly number[];
  readonly length: number;
  positionAt(distance: number, segHint?: number): { x: number; y: number; segIndex: number };
}
```

- `segHint` 기본값은 0이며 결과의 `segIndex`를 적의 캐시에 저장합니다. 정확히 꺾이는 점에서는 다음 구간을 사용하고, 마지막 점에서는 마지막 구간을 사용합니다.
- 경로 밖 거리는 `[0, length]`로 제한합니다. 밀치기로 거리가 줄면 캐시에서 앞 구간으로도 탐색합니다.
- 연속 중복점만 제거합니다. 한 점이면 길이는 0이며 그 점을 반환합니다. 지상 경유점에서의 180° 회전은 압축하지 않아 되돌아가는 이동 거리를 보존합니다.
- T1.2에서는 모든 콘텐츠 경로의 생성을 테스트합니다. T1.3의 `createBattle`이 이 API를 사용해 `StageRuntime.routes`를 구성합니다.

## 4. 도토리 (DP)

- 시작값은 `stage.startDp`, 최대값은 `DP_MAX = 99`입니다.
- 매 틱 `dpTicks += 1`. `dpTicks >= ticksPerDp`가 되면 `dp += 1; dpTicks = 0`입니다 (`ticksPerDp = round(TICK_RATE / stage.dpPerSec)`, 기본 30).
- `dp === DP_MAX`이면 `dpTicks`는 0에 머뭅니다 (진행분을 저장하지 않음).
- UI 게이지용 진행률은 `dpTicks / ticksPerDp`입니다.
- 스킬 `gainDp`와 후퇴 환급도 최대값을 넘지 않습니다.

## 5. 로스터, 배치, 후퇴

로스터는 스테이지에서 쓸 수 있는 유닛 목록입니다 (`stage.roster`, 없으면 전체). 슬롯마다 다음 상태를 가집니다.

```ts
interface RosterSlot {
  unitId: string;
  state: 'ready' | 'deployed' | 'cooldown';
  cooldownTicks: number;   // state === 'cooldown'일 때 남은 틱
  uid: number | null;      // 배치 중인 엔티티
}
```

**배치 검증.** 위에서부터 차례로 검사하고, 처음 걸린 이유로 거부합니다.

| 순서 | 거부 이유 `reason` | 조건 |
| --- | --- | --- |
| 1 | `ended` | 전투가 끝남 |
| 2 | `notReady` | 슬롯 상태가 `ready`가 아님 |
| 3 | `limit` | 배치 중인 유닛 수 ≥ `stage.deployLimit` |
| 4 | `noDp` | `dp < cost` |
| 5 | `badTile` | 맵 밖이거나 타일 종류가 `deployOn`과 맞지 않음 |
| 6 | `occupied` | 그 칸에 이미 유닛이 있음 |

적이 서 있는 지상 칸에도 배치할 수 있습니다.

**배치 성공 시**
- `dp -= cost`
- 유닛 엔티티 생성: `hp = maxHp`, `sp = skill.spStart`, `atkCooldown = 0`, 방향 `dir`
- 슬롯을 `deployed`로 바꾸고 `unitDeploy` 이벤트를 냅니다.
- 재배치 비용 증가(명일방주의 1.5배·2배)는 v0.1에서 **적용하지 않습니다.**

**후퇴** (`retreat`): 배치 중이면 언제든 가능합니다.
- `dp += floor(cost * RETREAT_REFUND_RATIO)` (0.5)
- 저지 중인 적을 모두 풀어 줍니다.
- 슬롯을 `cooldown`으로 바꾸고 `cooldownTicks = secToTicks(redeploySec)`. 이벤트는 `unitRetreat`.

**쓰러짐**: 후퇴와 같지만 환급이 없고 이벤트는 `unitDie`입니다.

**재배치 대기**: 매 틱 `cooldownTicks -= 1`. 0이 되면 `ready`.

## 6. 적 스폰과 이동

**스폰**: `stage.spawns`의 그룹마다 `atSec`부터 `intervalSec` 간격으로 `count`마리를 냅니다. i번째 적의 스폰 틱은 `secToTicks(atSec) + i * secToTicks(intervalSec)`입니다. 같은 틱이면 그룹 순서(배열 순서)대로 냅니다.

새 적의 초기값은 `dist = 0`, 위치는 경로 시작점, `hp = maxHp`, `atkCooldown = 0`, `blockedBy = null`입니다.

**이동** (매 틱)
- `px, py`에 현재 위치를 저장합니다 (렌더 보간용).
- 저지당했거나(`blockedBy !== null`) 기절 중이면 움직이지 않습니다.
- 그 외에는 `dist += def.speed * (1 - slowAmount) / TICK_RATE`.
- `dist >= length`이면 **누수**입니다: `life -= def.lifeDamage`, 적 제거, `leaked += 1`, `enemyLeak` 이벤트.

## 7. 저지 (블록)

- 저지 능력이 있는 것은 `deployOn: "ground"`이고 실제 저지 수가 1 이상인 유닛뿐입니다.
- **실제 저지 수** = `def.block + 활성 blockAdd 합계`.
- **비행 적은 절대 저지되지 않습니다.**

**새로 저지하는 조건** (매 틱 이동이 끝난 뒤 검사)
1. 적이 아직 저지되지 않았음
2. 적 위치와 유닛 타일 중심의 거리 ≤ `BLOCK_CONTACT_DIST` (0.7)
3. 적의 진행 방향 앞쪽에 유닛이 있음: 현재 구간 방향 벡터와 (유닛 중심 − 적 위치)의 내적 > 0
4. `유닛이 저지 중인 적들의 blockCost 합 + 이 적의 blockCost ≤ 실제 저지 수`

검사 순서: 유닛은 uid 오름차순, 각 유닛마다 적은 `remaining` 오름차순(같으면 uid 오름차순)으로 봅니다.
저지되면 `enemy.blockedBy = unit.uid`, `unit.blocking.push(enemy.uid)`, `block` 이벤트를 냅니다. 저지된 적은 그 자리에 멈춥니다 (위치를 옮기지 않음).

**풀어 주는 경우**
- 유닛이 후퇴하거나 쓰러짐 → 저지 중인 적 전부
- 실제 저지 수가 줄어 합계를 넘음 (예: `blockAdd` 스킬 종료) → 가장 나중에 저지한 적부터, 합계가 맞을 때까지
- `pushback`으로 밀려남 → 그 적

풀려난 적은 `blockedBy = null`이 되고 `unblock` 이벤트가 나갑니다. 같은 틱의 저지 단계에서 다른 유닛에게 다시 저지될 수 있습니다.

## 8. 사거리와 타겟팅

**사거리**
- 사거리 정의(`ranges.json`)는 오른쪽을 바라볼 때의 `[dx, dy]` 오프셋 목록입니다.
- 방향별 회전 (`src/core/grid.ts`):

| dir | (dx, dy) → |
| --- | --- |
| `right` | (dx, dy) |
| `down` | (−dy, dx) |
| `left` | (−dx, −dy) |
| `up` | (dy, −dx) |

- 사거리 타일 = 유닛 타일 + 회전된 오프셋. 맵 밖 타일은 버립니다.
- 적이 사거리 안인지는 **적 위치가 속한 타일이 사거리 타일 집합에 있는지**로 판정합니다.
- 비행 적은 `canHitAir`인 유닛만 노릴 수 있습니다.
- 유닛은 **자신이 저지 중인 적은 사거리와 상관없이 항상 공격할 수 있습니다.**

**공격 대상 선택** (피해형 유닛)
1. 자신이 저지 중인 적 (`blocking` 배열 순서)
2. 사거리 안 공격 가능한 적 중 `remaining`이 가장 작은 적
3. 같으면 uid가 작은 적

**회복 대상 선택** (`damageType: "heal"`): 사거리 안 아군 중 `hp < maxHp`인 유닛 가운데 hp 비율이 가장 낮은 유닛을 고릅니다. 같으면 uid가 작은 유닛. 대상이 없으면 아무것도 하지 않습니다.

## 9. 공격과 피해

**유닛 공격** (매 틱, uid 오름차순)
```
if (u.atkCooldown > 0) u.atkCooldown -= 1;
if (u.atkCooldown === 0) {
  const target = pickTarget(u);
  if (target) { performAttack(u, target); u.atkCooldown = atkIntervalTicks(u); }
  // 대상이 없으면 0에 머물러 있다가 대상이 생기면 바로 공격
}
```
- `atkIntervalTicks(u) = max(1, round(def.atkIntervalSec * 곱해진 atkInterval 배율 * TICK_RATE))`
- 피해는 **즉시** 적용합니다. 투사체 비행은 화면 연출일 뿐입니다 (04 문서).
- 공격할 때마다 `attack` 이벤트, 피해마다 `damage` 이벤트를 냅니다.

**피해 공식** (`src/sim/formulas.ts`)

| damageType | 피해량 |
| --- | --- |
| `physical` | `max(atk - def, atk * MIN_DAMAGE_RATIO)` |
| `magic` | `max(atk * (1 - res / 100), atk * MIN_DAMAGE_RATIO)` |
| `true` | `atk` |
| `heal` | 대상 `hp = min(maxHp, hp + atk)` |

`MIN_DAMAGE_RATIO = 0.05`. sim은 반올림하지 않습니다. 화면에 표시할 때만 반올림합니다.

**공격 시 추가 효과** (스킬이나 특성에서 활성화된 것)
- `splash { radius }`: 주 대상 위치에서 거리 ≤ radius 안의 다른 적에게도 같은 피해를 줍니다. 공격자가 `canHitAir`가 아니면 비행 적은 제외합니다.
- `onHitSlow { amount, sec }`: 맞은 적 전부(스플래시 포함)에 둔화를 겁니다.
- `stunEveryNthHit { n, sec }`: 스킬 중 공격 횟수를 세다가 n번째마다 주 대상을 기절시킵니다. 카운터는 스킬 시작 때 0이 됩니다.

**적 공격**: 저지된 적만 공격하며, 대상은 자신을 저지한 유닛입니다. 쿨다운 방식은 유닛과 같고, 공식은 적의 `damageType`(physical 또는 magic)을 씁니다. `atk`가 0인 적은 공격하지 않습니다.

**스탯 계산** (`src/sim/stats.ts`): 실제 스탯 = 기본값 × (활성 `statMul` 중 해당 스탯 값의 곱). `blockAdd`는 더합니다. 버프는 같은 효과끼리도 중첩되지만, v0.1에서는 한 유닛에 스킬이 하나라 사실상 중첩되지 않습니다.

## 10. SP와 스킬

유닛마다 `sp`(실수)와 `skillState: 'charging' | 'ready' | 'active'`를 가집니다.

**충전** (`charging`일 때만)
| charge | 증가 |
| --- | --- |
| `auto` | 매 틱 `1 / TICK_RATE` |
| `attack` | 공격 1회(회복 포함)마다 +1 |
| `hit` | 피해를 1번 받을 때마다 +1 |

`sp`가 `spCost`에 도달하면 `sp = spCost`, 상태를 `ready`로 바꾸고 `skillReady` 이벤트를 한 번 냅니다.
auto 충전은 `1/30`을 계속 더하므로 부동소수 오차가 생깁니다. 그래서 `sp >= spCost - SP_EPSILON`(1e-6)이면 도달한 것으로 봅니다.

**발동 조건** (`condition`). 수동·자동 발동 모두에 적용합니다.
| condition | 참인 경우 |
| --- | --- |
| `always` | 항상 |
| `enemyInRange` | 공격 가능한 적이 사거리 안에 있거나 저지 중 |
| `allyDamagedInRange` | 사거리 안에 `hp < maxHp`인 아군이 있음 |

**발동**
- `trigger: "auto"`: `ready`이고 조건이 참이면 스킬 단계에서 자동으로 발동합니다.
- `trigger: "manual"`: `activateSkill` 명령으로만 발동합니다. 검사 순서와 거부 이유는 `ended` → `notDeployed`(uid가 배치 중이 아님) → `autoSkill`(자동 발동 스킬) → `skillNotReady` → `noTarget`(조건 거짓)입니다.
- 발동하면 `skillStart` 이벤트를 내고, 즉시 효과를 적용하고, 지속 효과를 버프로 붙입니다.
  - `durationSec`가 0인 스킬: 즉시 `sp = 0`, `charging`, 같은 틱에 `skillEnd`.
  - 지속 스킬: `active`, `skillTicksLeft = secToTicks(durationSec)`. 상태 단계에서 매 틱 1씩 줄고, 0이 되면 버프 제거, `sp = 0`, `charging`, `skillEnd`.
- `active` 동안에는 SP가 차지 않습니다.

**효과 목록** (`Effect`, 타입은 03 문서)

| type | 시점 | 동작 |
| --- | --- | --- |
| `statMul { stat, value }` | 지속 / 특성 | atk·def·res·atkInterval에 곱함 |
| `blockAdd { value }` | 지속 | 저지 수 증가. 끝나면 7절 규칙으로 초과분 해제 |
| `splash { radius }` | 지속 / 특성 | 9절 |
| `onHitSlow { amount, sec }` | 지속 / 특성 | 9절, 11절 |
| `stunEveryNthHit { n, sec }` | 지속 | 9절 |
| `gainDp { value }` | 즉시 | 도토리 증가 (최대 99) |
| `healAllies { ratioOfMaxHp }` | 즉시 | 사거리 안 아군 전원 `maxHp * ratio` 회복 (자신 포함, 사거리에 자기 칸이 있으면) |
| `pulseDamage { count, intervalSec, atkMul, damageType }` | 지속 | 발동 틱에 1회, 이후 `intervalSec`마다 사거리 안 공격 가능한 적 전부에게 `atk * atkMul`로 피해, 총 `count`회. `durationSec ≥ (count−1) × intervalSec` |
| `slowAura { amount }` | 지속 | 매 틱 사거리 안 적 전부에 1틱짜리 둔화(갱신형) |
| `pushback { tiles }` | 즉시 | 대상(저지 중인 첫 적, 없으면 8절 규칙의 첫 대상)을 `dist -= tiles`(최소 0)로 되돌리고 저지 해제 |

**특성** (`traits`): 유닛에 항상 적용되는 효과입니다. 허용 타입은 `statMul`, `splash`, `onHitSlow`뿐이며 검증기가 확인합니다.

## 11. 적 상태이상

- **둔화**: `slowAmount`, `slowUntilTick`. 새 둔화가 들어오면
  - 기존보다 강하면 (amount 큼) 교체합니다.
  - 같은 세기면 끝나는 시각을 더 늦은 쪽으로 늘립니다.
  - 약하면 기존이 끝나기 전까지 무시합니다.
  - 상한은 `SLOW_CAP = 0.8`입니다.
- **기절**: `stunUntilTick = max(기존, 새 값)`. 기절 중에는 이동과 공격을 하지 않고, 공격 쿨다운도 멈춥니다.
- 만료는 상태 단계에서 `tick >= until`이면 해제합니다. 해제될 때 `status` 이벤트를 냅니다 (연출 끄기용).

## 12. 사망과 정리

- 사망 단계에서 `hp <= 0`인 적을 제거합니다: 저지 해제, `killed += 1`, `enemyDie` 이벤트.
- `hp <= 0`인 유닛을 제거합니다: 저지 해제, 슬롯을 cooldown으로, `unitDie` 이벤트.
- 한 틱 안에서는 hp가 0 이하가 되어도 사망 단계 전까지 남아 있습니다. 이번 틱의 다른 공격이 이미 죽은 대상을 고르지 않도록 대상 선택에서 `hp > 0`인 것만 고릅니다.

## 13. 승패

- **패배**: `life <= 0`이 되는 즉시 (누수 처리 직후) `phase = 'lost'`.
- **승리**: 모든 스폰이 끝났고, 살아 있는 적이 없고, `life > 0`이면 `phase = 'won'`.
- 끝나면 `battleEnd` 이벤트를 한 번 내고, 이후 `step()`은 아무것도 하지 않습니다 (tick도 그대로).
- **웨이브 표시**: 현재 웨이브 = 스폰 시작 틱이 지난 그룹 중 가장 큰 `wave` 값, 전체 웨이브 = 최대 `wave` 값.

## 14. 틱 순서 (step 한 번)

| 단계 | 파일 | 내용 |
| --- | --- | --- |
| 1 | `commands.ts` | 큐의 명령을 받은 순서대로 검증 후 적용 |
| 2 | `dp.ts` | 도토리 증가 |
| 3 | `roster.ts` | 재배치 대기 감소 |
| 4 | `spawn.ts` | 이번 틱 스폰 |
| 5 | `status.ts` | 둔화·기절 만료, slowAura 적용, 스킬 남은 시간 감소와 종료 |
| 6 | `movement.ts` | 적 이동, 누수, 패배 체크 |
| 7 | `block.ts` | 초과분 해제, 새 저지 |
| 8 | `skills.ts` | auto SP 충전, ready 전환, 자동 발동 |
| 9 | `attack.ts` | 유닛 공격, 예정된 pulseDamage 적용 |
| 10 | `enemyAttack.ts` | 적 공격 |
| 11 | `death.ts` | 사망 정리 |
| 12 | `outcome.ts` | 승리 체크 |
| 13 | — | `tick += 1` |

이벤트는 이 순서대로 쌓입니다. `flush()`는 1단계만 실행합니다.

## 15. 규칙 상수 (src/sim/constants.ts)

| 이름 | 값 | 설명 |
| --- | --- | --- |
| `TICK_RATE` | 30 | 초당 틱 |
| `DP_MAX` | 99 | 도토리 최대 |
| `DEFAULT_DP_PER_SEC` | 1 | 스테이지에 `dpPerSec`가 없을 때 |
| `RETREAT_REFUND_RATIO` | 0.5 | 후퇴 환급 비율 (내림) |
| `MIN_DAMAGE_RATIO` | 0.05 | 최소 피해 비율 |
| `BLOCK_CONTACT_DIST` | 0.7 | 저지 접촉 거리 (타일) |
| `SLOW_CAP` | 0.8 | 둔화 상한 |
| `SP_EPSILON` | 1e-6 | SP 도달 판정 오차 |

앱 쪽 상수 (`src/app/loop.ts`): `MAX_STEPS_PER_FRAME = 8`, `BULLET_TIME_SCALE = 0.25`.

## 16. 결정론

- sim 안에서 `Math.random`, `Date`, `performance`를 쓰지 않습니다. 난수가 필요해지면 `state.rngState`의 mulberry32를 씁니다 (v0.1 규칙에는 난수가 없음).
- 배열은 항상 uid 순서로 돌고, 정렬할 때는 반드시 uid로 마지막 동점을 깹니다.
- 삼각함수 결과로 게임 판정을 하지 않습니다 (sqrt는 허용).
- 같은 콘텐츠 + 같은 스테이지 + 같은 명령 기록(틱 포함)이면 항상 같은 `hashState(state)`가 나와야 합니다.

## 17. 명령과 이벤트 타입

```ts
// Dir, Tile은 src/core/grid.ts에 정의
export type Dir = 'right' | 'down' | 'left' | 'up';
export interface Tile { x: number; y: number }

export type Command =
  | { type: 'deploy'; unitId: string; tile: Tile; dir: Dir }
  | { type: 'retreat'; uid: number }
  | { type: 'activateSkill'; uid: number };

export type RejectReason =
  | 'ended' | 'notReady' | 'limit' | 'noDp' | 'badTile' | 'occupied'   // deploy
  | 'notDeployed'                                                       // retreat, activateSkill
  | 'skillNotReady' | 'noTarget' | 'autoSkill';                         // activateSkill (autoSkill = 자동 발동 스킬은 수동 불가)

export interface Ref { kind: 'unit' | 'enemy'; uid: number }

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
```

- uid는 유닛과 적이 하나의 카운터를 공유합니다 (1부터 시작). 그래서 uid만으로도 엔티티가 유일하게 정해집니다.
- `attack.ranged`는 유닛의 사거리 정의가 `melee`가 아니면 true입니다. 연출에서 투사체를 날릴지 정할 때 씁니다.

## 18. 상태 타입 (요약)

```ts
export interface BattleState {
  tick: number;
  phase: 'running' | 'won' | 'lost';
  dp: number; dpTicks: number;
  life: number; maxLife: number;
  roster: RosterSlot[];
  units: UnitEntity[];      // uid 오름차순
  enemies: EnemyEntity[];   // uid 오름차순
  spawnCursor: number[];    // 그룹별로 이미 낸 마리 수
  totalEnemies: number; killed: number; leaked: number;
  nextUid: number;
  rngState: number;
}

export interface UnitEntity {
  uid: number; unitId: string; tile: Tile; dir: Dir;
  hp: number; maxHp: number;
  atkCooldown: number;
  sp: number; skillState: 'charging' | 'ready' | 'active'; skillTicksLeft: number;
  skillHitCount: number;              // stunEveryNthHit용
  pulsesLeft: number; nextPulseTick: number;
  blocking: number[];                 // 저지 중인 적 uid (저지한 순서)
  buffs: ActiveEffect[];              // 스킬 지속 효과
}

export interface EnemyEntity {
  uid: number; enemyId: string; routeId: string;
  dist: number; segIndex: number;
  x: number; y: number; px: number; py: number;
  hp: number; maxHp: number;
  atkCooldown: number;
  blockedBy: number | null;
  slowAmount: number; slowUntilTick: number;
  stunUntilTick: number;
}
```

구현하면서 필드를 더해도 됩니다. 단, 여기 있는 이름과 의미는 유지합니다.
