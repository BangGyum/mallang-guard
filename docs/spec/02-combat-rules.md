# 02. 전투 규칙

모든 규칙은 `src/sim`에 구현합니다. 콘텐츠 수치는 `src/data/*.json`, 규칙 상수는 `src/sim/constants.ts`에 둡니다.
2026-10-07 사용자 확정: **친구는 보라색 고지대에서 자동 공격합니다. 아군 체력·피격·사망·길 위 저지는 없으며, 각 친구에게 스킬이 하나씩 있습니다.**

## 1. 시간

- 1틱 = 1/30초. `state.tick`은 다음 처리할 틱이며 첫 `step()`은 0틱입니다.
- `secToTicks(sec) = round(sec * 30)`. 양수는 최소 1틱입니다.
- 배속·일시정지·슬로모션은 앱이 관리합니다. `flush()`는 명령만 처리하며 시간을 진행하지 않습니다.

## 2. 좌표와 맵

- `(x, y)`는 열·행이며 타일 중심은 `(x + 0.5, y + 0.5)`입니다.
- 적이 속한 칸은 `(floor(x), floor(y))`입니다.

| 문자 | kind | 지상 적 이동 | 친구 배치 |
| --- | --- | --- | --- |
| `.` | ground | O | X |
| `,` | path | O | X |
| `H` | high | X | 모든 친구 |
| `#` | blocked | X | X |
| `S` | spawn | O | X |
| `G` | goal | O | X |

모든 행의 길이는 같아야 합니다. 지상 적은 상하좌우로 이동합니다. 배치로 경로가 바뀌거나 막히지 않습니다.

## 3. 경로

`routes`의 `{ from, via?, to, flying? }`를 전투 시작 시 한 번 계산해 `StageRuntime.routes`에 저장합니다.

- 지상: from → via → to의 각 구간을 A*로 계산합니다. 이동 칸은 ground/path/spawn/goal, 비용 1, 맨해튼 휴리스틱입니다.
- 이웃 순서는 right/down/left/up. 동점은 f → h → 먼저 열린 노드 순으로 결정합니다.
- 타일 중심을 연결하고 같은 방향의 중간점을 제거해 폴리라인으로 만듭니다. 연속 중복점만 없애고 180도 되돌아가는 경로는 보존합니다.
- 비행: 지형을 무시하고 from/via/to의 중심을 직선으로 연결합니다.
- 경로를 만들 수 없으면 `createBattle`이 경로명을 포함해 throw합니다.
- 위치는 출발점부터의 `dist`, 우선순위는 `remaining = length - dist`로 정합니다.
- `positionAt(distance, segHint = 0)`는 거리를 `[0, length]`로 제한하고 `{ x, y, segIndex }`를 반환합니다. 꺾이는 점은 다음 구간, 마지막 점은 마지막 구간입니다. 밀치기로 거리가 줄면 앞 구간도 탐색합니다.
- 공개 함수: `findTilePath(board, from, to)`, `buildRoute(board, route)`, `createPolyline(points)`.

## 4. 도토리 (DP)

- 시작값 `stage.startDp`, 최대 99.
- 매 틱 `dpTicks += 1`. `round(30 / dpPerSec)`틱마다 +1, 진행분은 0으로 초기화합니다. 기본 초당 1개입니다.
- 최대치에서는 진행분을 저장하지 않습니다. 후퇴·스킬 지급도 최대 99로 제한합니다.
- UI는 `dpTicks / ticksPerDp`를 회복 진행률로 씁니다.

## 5. 로스터, 배치, 후퇴

슬롯은 `{ unitId, state: ready | deployed | cooldown, cooldownTicks, uid }`입니다. stage.roster가 없으면 전체 친구를 사용합니다.

배치 거부 순서: `ended` → `notReady` → `limit` → `noDp` → `badTile` → `occupied`.

- 정수 좌표의 빈 `high` 칸에만 배치할 수 있습니다. 캐릭터마다 지상/고지대를 나누지 않습니다.
- 성공하면 비용 차감, uid 생성, 방향과 공격 쿨다운 0, `spStart`를 설정합니다. 슬롯은 deployed가 되고 `unitDeploy`를 냅니다.
- 초기 SP가 가득 찼으면 즉시 ready로 전환해 같은 flush의 다음 스킬 명령도 처리합니다.
- 아군 데이터와 엔티티에는 HP·방어력·마법저항·저지 필드가 없습니다.
- 후퇴는 `floor(cost * 0.5)`를 실제 상한까지 환급하고 엔티티를 제거합니다. 발동 중인 스킬·오라도 함께 제거됩니다.
- `unitRetreat.refund`, `dpGain.amount`는 실제 환급량입니다. 0이면 dpGain은 생략합니다.
- 후퇴한 슬롯은 `secToTicks(redeploySec)` 동안 cooldown. 매 틱 감소하고 0이면 ready입니다. 재배치 비용 증가는 없습니다.

## 6. 적 스폰과 이동

- 그룹 i번째 스폰 시각은 `secToTicks(atSec) + i * secToTicks(intervalSec)`입니다. 같은 틱은 그룹 배열 순서입니다.
- 예약 스폰은 `dist = 0`, 위치는 경로 시작점, `hp = maxHp`입니다. M4 분열 자식은 부모의 경로와 처치 위치에서 생성합니다. 아군 피해·저지 필드는 없으며 방해 능력의 정수 틱 쿨다운만 가집니다.
- 매 틱 px/py에 이전 위치를 저장합니다. 기절 중인 적과 이미 죽은 적은 움직이지 않습니다.
- 그 외에는 `dist += speed * (1 - slowAmount) / 30`.
- 골에 도착하면 lifeDamage만큼 푸딩 감소, 적 제거, leaked 증가, enemyLeak 이벤트를 냅니다. 푸딩 0이면 즉시 패배합니다.

## 7. 디펜스 방식

친구는 고지대에 머물며 적이 사거리에 들어오면 자동 공격합니다. 적은 친구와 몸으로 부딪혀 멈추거나 반격하지 않습니다. 이동 방해는 스킬·특성의 둔화, 기절, 밀치기로만 발생합니다.

## 8. 사거리와 타겟팅

- ranges.json은 오른쪽 기준 `[dx, dy]` 목록입니다. right `(dx,dy)`, down `(-dy,dx)`, left `(-dx,-dy)`, up `(dy,-dx)`로 회전합니다.
- 유닛 타일에 더하고 맵 밖 칸을 제외합니다. 적의 현재 칸이 포함되면 사거리 안입니다.
- 살아 있는 적 중 `remaining`이 가장 작은 적, 같으면 uid가 작은 적을 고릅니다.
- 비행 적은 `canHitAir` 친구만 공격합니다. 범위 공격·펄스·둔화 오라에도 같은 대공 조건이 적용됩니다.
- 사거리 밖 적을 공격하는 저지 우선 규칙이나 아군 회복 타겟팅은 없습니다.

## 9. 자동 공격과 피해

- 유닛 uid 순서로 쿨다운을 1씩 줄입니다. 0이며 대상이 있으면 즉시 공격하고 간격을 다시 설정합니다. 대상이 없으면 0에서 기다립니다.
- 실제 공격력 = 기본 공격력 × statMul(atk)의 곱.
- 공격 간격 = `max(1, round(기본 초 * statMul(atkInterval)의 곱 * 적용 중 hasteAura의 곱 * 방해 배율 * 30))`. 방해가 없으면 배율은 1입니다.
- 간격은 공격 직후 결정합니다. 버프가 생겨도 이미 진행 중인 쿨다운은 소급 변경하지 않습니다.
- 물리 피해: `max(atk - def, atk * 0.05)`. 마법 피해: `max(atk * (1 - res / 100), atk * 0.05)`. true 피해: atk.
- 피해는 즉시 적용하고 attack/damage 이벤트를 냅니다. sim에서는 반올림하지 않습니다.
- 스플래시는 주 대상 주변 반경 안의 살아 있는 적들에게 같은 공격력으로 피해를 줍니다. 각 적의 방어·마저를 적용합니다.
- onHitSlow는 스플래시 대상에도 적용합니다. stunEveryNthHit는 활성 스킬의 공격 횟수를 세고 n번째마다 주 대상을 기절시킵니다.

## 10. SP와 스킬

모든 친구에게 고유 스킬 하나가 있습니다. 상태는 charging/ready/active입니다.

- auto 충전은 초당 1 SP, attack 충전은 실제 공격 1회마다 1 SP입니다. 피격 충전은 없습니다.
- charging일 때만 충전하며 spCost에서 멈춥니다. `SP_EPSILON = 1e-6` 오차를 허용합니다. ready 이벤트는 전환 시 한 번만 냅니다.
- 발동 조건은 always 또는 enemyInRange입니다. 토끼는 ready 상태로 적을 기다렸다가 자동 발동합니다.
- 수동 명령 거부 순서: ended → notDeployed → autoSkill → skillNotReady → noTarget.
- 즉시형은 발동 즉시 효과 적용 후 SP 0, charging, skillEnd. 지속형은 `skillEndTick = 현재 틱 + 지속 틱`까지 active입니다.
- 활성 중에는 충전하지 않습니다. 만료 틱에서 버프 제거·SP 0·skillEnd, 다음 틱부터 자동 재충전합니다.
- 펄스는 발동 틱부터 interval 틱 간격으로 count회. 마지막 펄스와 만료 틱이 같으면 펄스를 먼저 적용합니다. 각 초를 틱으로 반올림해 마지막 펄스가 늦어지는 경우 종료 시각을 마지막 펄스까지 보존합니다.

| 효과 | 동작 |
| --- | --- |
| statMul | 자신의 atk 또는 atkInterval에 배율 적용 |
| splash | 기본 공격의 범위 피해 |
| onHitSlow | 공격한 적의 이동 속도 감소 |
| stunEveryNthHit | n번째 공격의 주 대상 기절 |
| gainDp | 즉시 도토리 지급, 최대 99 |
| hasteAura | 사거리 안 아군의 공격 간격에 배율 적용. 자기 칸 포함 시 자신도 적용 |
| pulseDamage | 사거리 안 공격 가능한 적 전부에 반복 피해 |
| slowAura | 매 틱 범위 안 공격 가능한 적에게 1틱 둔화 갱신 |
| pushback | 우선 대상의 dist를 지정 칸만큼 감소, 최소 0. 위치·이전 위치·구간 캐시도 갱신 |

특성은 statMul/splash/onHitSlow만 허용하며 항상 적용합니다. skill buffs는 지속 스킬이 끝나거나 후퇴하면 제거됩니다.

## 11. 적 상태이상

- 둔화: 가장 강한 것 우선. 같은 세기는 더 늦은 만료 시각을 사용하며 약한 효과는 무시합니다. 상한 80%.
- 기절: 기존/신규 중 더 늦은 만료 시각. 기절 중에는 이동하지 않습니다.
- `tick >= until`이면 해제하고 status(on:false)를 냅니다. 새 상태가 생기면 status(on:true)를 냅니다.
- slowAura는 범위를 벗어나거나 시전자가 후퇴한 뒤 다음 틱에 만료됩니다.

## 12. 처치와 정리

HP가 0 이하인 적만 uid 순서로 제거하고 killed 증가·enemyDie를 냅니다. 같은 틱의 다른 공격은 이미 죽은 대상을 고르지 않습니다. 친구는 전투 중 쓰러지지 않습니다.

M4 분열젤리는 처치 시 같은 경로에 작은 젤리를 생성하고 `totalEnemies`를 실제 생성 수만큼 늘립니다. 자식 간격은 뒤쪽으로 0.28타일이며 최소 거리는 0입니다. 누수 시에는 분열하지 않고 자식은 재분열할 수 없습니다. 승리는 자식까지 처치한 후 판정합니다.

## 13. 승패

- 패배: 누수 직후 life <= 0이면 즉시 lost. 같은 틱의 나머지 이동·공격을 멈춥니다.
- 승리: 모든 스폰 종료, 적 없음, life > 0이면 won.
- battleEnd는 한 번만 냅니다. 종료한 step은 tick을 1 증가시키며 이후 step은 아무 일도 하지 않습니다.
- currentWave는 이미 시작한 스폰 그룹의 최대 wave, totalWaves는 전체 최대 wave. 시작 전은 0입니다.

## 14. 틱 순서

명령 → DP → 재배치 대기 → 스폰 → 예약 펄스·스킬 만료·상태이상/아군 방해 만료·둔화 오라 → 적 이동·누수 → 적 방해 능력 → SP 충전·자동 스킬 → 아군 자동 공격 → 적 처치·분열 → 승리 확인 → tick 증가.

flush는 명령만 처리합니다. 수동 스킬의 즉시 효과·첫 펄스도 flush 안에서 발생하므로 일시정지 중 사용이 가능합니다.

## 15. 규칙 상수

| 상수 | 값 |
| --- | --- |
| TICK_RATE | 30 |
| DEFAULT_SEED | 1 |
| DP_MAX | 99 |
| DEFAULT_DP_PER_SEC | 1 |
| RETREAT_REFUND_RATIO | 0.5 |
| MIN_DAMAGE_RATIO | 0.05 |
| SLOW_CAP | 0.8 |
| SP_EPSILON | 1e-6 |
| SPLIT_SPACING | 0.28 |

앱의 MAX_STEPS_PER_FRAME은 8, BULLET_TIME_SCALE은 0.25입니다.

## 16. 결정론

seed는 uint32로 정규화해 rngState에 보관하며 0도 유효합니다. sim은 Math.random/DOM/Date/performance를 쓰지 않습니다. 엔티티는 uid 순서이며 정렬 동점도 uid로 해소합니다. 같은 데이터·시드·명령이면 상태와 이벤트가 같습니다.

## 17. 명령과 이벤트 계약

정확한 타입은 [src/sim/types.ts](../../src/sim/types.ts)에 정의합니다.

- Command: deploy(unitId/tile/dir), retreat(uid), activateSkill(uid).
- UnitEntity: uid/unitId/tile/dir, 공격 쿨다운, SP/스킬 상태/종료 틱/공격 횟수/펄스 일정/buffs, `disruptedUntilTick`(기본 0), `disruptionMul`(기본 1). 체력 필드는 없습니다.
- EnemyEntity: 경로·현재/이전 위치·거리·HP·둔화/기절 일정, `abilityCooldown`(정수 틱). 반격·저지 필드는 없습니다.
- 이벤트: commandRejected, unitDeploy/unitRetreat/unitDisrupt, enemySpawn/enemyLeak/enemyDie, attack/damage, status, skillReady/skillStart/skillPulse/skillEnd, dpGain, battleEnd.
- `enemySpawn`은 `uid`, `enemyId`, 생성 위치의 `x`, `y`를 담습니다. 분열 자식만 선택 필드 `parentUid`를 가지며 원거리 부모 처치 연출과 등장 시점을 맞추는 데 사용합니다. 같은 틱에 처치되어 최종 상태에서 빠져도 등장·투사체·사망 연출의 위치를 복원할 수 있어야 합니다.
- `unitDisrupt`는 `{ src: 적 uid, uid: 아군 uid, untilTick }`입니다. 이벤트 생성·뷰·오버레이·오디오가 같은 계약을 사용합니다.
- unitDie/block/unblock/heal 이벤트는 제거했습니다. view/ui는 읽기만 하며 명령 enqueue로만 상태를 바꿉니다.

## 18. M4 공격 방해

끈적젤리와 왕젤리는 사거리 안의 가까운 친구부터 `targets`명까지 공격 간격을 늘립니다. 동점은 uid 순입니다. 등장 후 한 주기 충전하며 기절 중에는 충전·발사가 멈춥니다. 대상이 없으면 준비 상태를 유지합니다. 방해는 강한 배율과 긴 종료 시점을 유지하고 중첩 곱하지 않습니다. 만료·후퇴 때 제거되며 진행 중인 공격 쿨다운은 소급 변경하지 않습니다. 데이터와 별 평가 규칙은 [09-content-expansion.md](09-content-expansion.md)를 따릅니다.
