# 열린 질문과 임시 가정

구현 중에 스펙이 모호하면 **가장 단순한 해석**으로 진행하고, 여기에 한 줄 추가한 뒤 PR 설명에도 적습니다. 레포 주인이 답하면 결과를 스펙 본문에 반영하고 이 목록에서 지웁니다.

## 임시 가정 (확인 필요)

| 항목 | 지금 가정 | 바뀌면 영향 |
| --- | --- | --- |
| 화면 방향 | 가로 우선, 세로는 회전 안내 | 05 문서 HUD 배치, 04 문서 safeRect |
| 재배치 비용 증가 | 적용 안 함 | 02 문서 5절, 로스터 상태 |
| 뚜껑곰 도발 | v0.1에서 제외 | 원거리 적이 생기는 M4에서 재검토 |
| 별 3개 평가 기준 | 미정 (M4) | 결과 화면 |
| 슬로모션 배율 | 0.25배, 배치·조준·선택 중 | 설정에서 끌 수 있게 할지 |
| Vite 설정 export | Vite 로더가 default export만 읽으므로 `vite.config.ts`에만 예외 적용. 앱 소스는 named export 유지 | Vite 설정 로딩 |
| core 유틸 인터페이스 | `rotateOffset([dx, dy], dir)`는 `Tile` 반환, `rangeTiles(tile, offsets, dir, width, height)`는 입력 순서 유지. `mulberry32(state)`는 `{ value, state }`를 반환하는 순수 단일 스텝 | 사거리 조회와 `BattleState.rngState` 저장·복원 |
| Battle 런타임 필드 | `StageRuntime`은 원본 스테이지의 맵·경로·스폰을 `board`, `routes: ReadonlyMap<string, Path>`, 틱이 추가된 `spawns`로 바꾼 형태입니다. 웨이브는 `state.wave`와 `stage.totalWaves`, 활성 효과는 `Effect` 타입을 재사용합니다 | T1.4 조회 API와 T2.2 스킬 시스템 |

## 질문

- (아직 없음)
