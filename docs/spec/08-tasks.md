# 08. 작업 티켓

**규칙**
- 위에서부터 순서대로 하나씩 진행합니다. 한 티켓 = 한 브랜치 = 한 PR (브랜치 이름 예: `t1.3-battle-core`).
- 티켓을 끝내면 이 파일의 체크박스를 체크합니다.
- **완료 조건**에는 항상 `npm run check`, `npm run lint`, `npm test`, `npm run build`가 모두 통과하는 것이 포함됩니다 (아래에서 반복하지 않음).
- 화면이 바뀌는 티켓은 PR에 스크린샷을 붙입니다 (07 문서 5절).
- 스펙과 다르게 구현해야 했다면 같은 PR에서 스펙 문서를 고치고, PR 설명에 이유를 씁니다.

---

## 유닛 스킬 팝업 개선 (2026-10-07)

- 선택한 유닛 옆에 작은 스킬 팝업을 띄우고 이름·역할색 배지·선택 칸 연결선으로 해당 유닛의 스킬임을 표시합니다.
- 충전·준비·사용 중 상태, 수동 발동과 후퇴를 연결하고 닫기 버튼을 추가했습니다.
- 수동·자동 발동 시 유닛 이름과 스킬 이름을 1.9초 동안 알립니다. 화면 가장자리·HUD·캐릭터와의 겹침을 줄이고 모션 감소 설정을 반영합니다.
- 검증: check/lint/test/build, 33개 파일 456개 테스트 통과. `node tests/browser/skillPopover.mjs`로 PC 마우스·모바일 터치의 선택·닫기·충전·수동/자동 발동·후퇴, 알림 위치·겹침·소멸, 리사이즈·44px 터치 영역·모션 감소 설정을 확인했습니다. 브라우저 오류·경고 0건.
- 화면: [PC 준비](../verification/skill-popover-desktop-ready.png), [PC 발동](../verification/skill-popover-desktop-cast.png), [PC 자동](../verification/skill-popover-desktop-auto.png), [PC 사용 중](../verification/skill-popover-desktop-active.png), [모바일 준비](../verification/skill-popover-mobile-ready.png), [모바일 발동](../verification/skill-popover-mobile-cast.png), [모바일 자동](../verification/skill-popover-mobile-auto.png), [모바일 사용 중](../verification/skill-popover-mobile-active.png).

## 고지대 디펜스 수정 검증 (2026-10-07)

사용자가 아군 체력 없음·보라색 고지대 배치·자동 공격·개별 스킬을 확정했습니다. 아래 T1.4~T1.6의 체력·저지·반격 기록은 수정 전 검증 이력이며 현재 규칙은 02 문서입니다.

- 모든 친구의 HP·방어·저지, 적의 반격과 아군 사망·회복 루프를 제거했습니다.
- 스킬 8종과 효과 9종을 연결했습니다. 곰은 공격 강화·기절, 토끼는 주변 공격 속도 지원으로 교체했습니다.
- SP 충전/준비/발동 표시·설명·수동 발동 버튼·자동 스킬과 모바일 패널을 확인했습니다.
- 33개 파일 456개 테스트: 아군 8종의 배치, 스킬 8종, 만료·후퇴·거부 경계, 매 틱 결정론, 21마리 처치와 푸딩 3개 유지.
- check/lint/test/build, PC 마우스·모바일 터치 완주 및 키보드·취소·멀티터치 검증. 브라우저 오류·경고 0건.
- 화면: [PC 스킬](../verification/defense-desktop-skill.png), [모바일 스킬](../verification/defense-mobile-skill.png), [PC 전투](../verification/defense-desktop.png), [모바일 전투](../verification/defense-mobile.png), [PC 조준](../verification/defense-desktop-aim.png), [모바일 조준](../verification/defense-mobile-aim.png), [PC 승리](../verification/defense-desktop-clear.png), [모바일 승리](../verification/defense-mobile-clear.png).

## 병합 검증 (2026-10-07)

- `origin/t1.3-battle-core`의 별도 구현을 병합했습니다. 원격 전투·경로·콘텐츠 API, 유닛 사망 처리, CI 설정을 반영했습니다.
- 실제 동물·파스텔 정원 방향과 새 시안은 유지하고 카메라 피팅 및 PCF 그림자 개선을 적용했습니다.
- 로컬 회귀 사례와 원격 추가 검증을 함께 유지했습니다. `npm ci`, check/lint/test/build 및 22개 파일의 403개 테스트가 통과했습니다.
- 화면 확인: [1920×1080](../verification/merge-2026-10-07-desktop.png), [844×390](../verification/merge-2026-10-07-mobile.png).
- 아래 2026-10-06 기록은 각 로컬 티켓의 당시 검증 결과입니다. 현재 경로 API는 `buildRoute`/`Polyline.length`, 웨이브는 `state.currentWave`/`state.totalWaves`입니다.

## M0 세팅

### [x] T0.1 프로젝트 생성
- 읽을 문서: 01 (2절)
- 할 일
  - 레포 루트에 Vite `vanilla-ts` 구성을 만듭니다. 기존 `README.md`, `docs/`, `AGENTS.md`는 유지합니다.
  - 의존성: `three`. 개발 의존성: `vite`, `typescript`, `@types/three`, `vitest`, `@biomejs/biome`. 모두 최신 안정 버전으로 하고 `package-lock.json`을 커밋합니다.
  - `package.json`에 `"engines": { "node": "^22.12.0 || ^24.0.0 || >=26.0.0" }`, `.nvmrc`에 `24`를 둡니다.
  - 스크립트: `dev`, `build`(`tsc --noEmit && vite build`), `preview`, `check`(`tsc --noEmit`), `lint`(`biome check .`), `format`(`biome format --write .`), `test`(`vitest run`), `test:watch`.
  - `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `resolveJsonModule`, `moduleResolution: "bundler"`, target ES2022.
  - `biome.json`: 들여쓰기 2칸, 줄 길이 110, 작은따옴표. `docs/`는 린트에서 제외합니다.
  - `vite.config.ts`: `base`는 build일 때 `/mallang-guard/`, dev일 때 `/`. Vitest 설정도 여기에 둡니다 (`include: ['tests/**/*.test.ts']`, environment `node`).
  - `.github/workflows/ci.yml`: push와 PR에서 Node 24로 `npm ci → check → lint → test → build`.
- 완료 조건: `npm run dev`로 빈 페이지가 뜹니다. GitHub Actions CI가 초록입니다.
- 진행 상태 (2026-10-06): 로컬 구현, `npm ci`, check/lint/test/build와 개발·빌드 미리보기 로딩 확인 완료.
  T0.1 검증 당시 테스트 파일은 0개였습니다. GitHub 쓰기 인증이 확인되지 않아 원격 CI와 PR은 대기 중입니다.
  화면 확인: [1920×1080](../verification/t0.1-desktop.png), [844×390](../verification/t0.1-mobile.png).
- 완료 확인 (2026-10-07): GitHub 인증 후 후속 브랜치의 CI가 통과했습니다. 기존 인증 대기 표기를 완료로 갱신합니다.

### [x] T0.2 폴더 골격과 core 유틸
- 읽을 문서: 01 전체, 02 (8절 회전 표)
- 할 일
  - 01 문서 2절의 폴더를 만듭니다 (빈 파일 대신, 실제로 필요한 것만).
  - `src/core/grid.ts`(Dir, `rotateOffset`, `rangeTiles`), `rng.ts`(mulberry32), `math.ts`, `assert.ts`.
  - `tests/architecture.test.ts` (07 문서 4절).
  - `tests/sim/grid.test.ts`.
- 완료 조건: 아키텍처 테스트가 일부러 넣은 위반(`src/sim`에서 three import)을 잡는 것을 한 번 확인하고 되돌립니다.
- 검증 (2026-10-06): check/lint/test/build 통과, 5개 테스트 파일의 54개 테스트 통과.
  실제 `src/sim`의 임시 Three.js import를 검사 실패로 감지한 뒤 제거했고, 전체 검사가 다시 통과했습니다.
  `t0.2-core-utils` 브랜치에서 구현했으며 원격 PR은 GitHub 쓰기 인증 대기 중입니다.

### [ ] T0.3 GitHub Pages 배포
- 할 일
  - `.github/workflows/deploy.yml`: main에 push되면 빌드 → `actions/upload-pages-artifact`(dist) → `actions/deploy-pages`.
  - 필요한 권한(`pages: write`, `id-token: write`)과 `concurrency`를 설정합니다.
  - **레포 설정 변경은 사람이 합니다**: Settings → Pages → Source를 "GitHub Actions"로. PR 설명에 이 단계를 적습니다.
- 완료 조건: `https://banggyum.github.io/mallang-guard/`에서 페이지가 열립니다 (설정 후).
- 진행 상태 (2026-10-06): main push용 검사·빌드·Pages 업로드/배포 워크플로 구현. 로컬 검사 통과.
  저장소 쓰기 인증 및 관리자의 Pages Source 설정 후 공개 URL 확인이 필요하므로 완료 체크는 대기합니다.

### [x] T0.4 정적 보드 렌더
- 읽을 문서: 03 (1절 타입, stage-1), 04 (1~3절, 11절)
- 할 일
  - `src/data/types.ts`, `src/data/stages/stage-1.json`을 만듭니다. 검증기는 T1.1에서 만듭니다.
  - `src/sim/board.ts`: 맵 파싱 (`kindAt`, 크기).
  - `src/view`: 렌더러, 카메라 피팅, 타일 InstancedMesh, 받침, 조명, 그림자, 리사이즈.
  - `index.html` 레이어 구조 (01 문서 6절)와 CSS 하늘 그라데이션.
  - `tests/view/camera.test.ts`.
- 완료 조건: stage-1 지형이 목업과 비슷한 각도와 색으로 보입니다. 창 크기를 바꿔도 보드가 safeRect 안에 있습니다.
- 검증 (2026-10-06): 맵 파싱·타일 InstancedMesh·받침·조명·그림자·리사이즈 구현, check/lint/test/build 통과.
  실제 카메라 투영을 16:9, 4:3, 21:9, 844:390에서 검사했고 브라우저에서도 네 크기의 리사이즈를 확인했습니다.
  화면 확인: [1920×1080](../verification/t0.4-desktop.png), [844×390](../verification/t0.4-mobile.png).
  `t0.4-static-board` 로컬 브랜치 완료, 원격 PR은 쓰기 인증 대기 중입니다.

---

## M1 그레이박스 전투

### [x] T1.1 콘텐츠 데이터와 검증기
- 읽을 문서: 03 전체
- 할 일: JSON 5종, `validate.ts`, `index.ts`, `tests/data.test.ts`. `main.ts`에서 검증 실패 시 화면에 에러를 표시합니다.
- 완료 조건: 07 문서의 data 테스트 항목이 전부 통과합니다.
- 검증 (2026-10-06): 문서 03의 JSON, `ContentDb` Map과 참조·수치·효과·맵 검증 구현, check/lint/test/build 통과.
  오류 경로가 포함된 메시지를 화면에 표시하는 흐름도 브라우저에서 확인했습니다.
  화면 확인: [1920×1080 오류 화면](../verification/t1.1-content-error-desktop.png), [844×390 오류 화면](../verification/t1.1-content-error.png).
  모든 스테이지의 전투 초기화 및 막힌 경로 거부는 T1.3의 `battle.test.ts`에서 함께 검증합니다.
  `t1.1-content-validation` 로컬 브랜치 완료, 원격 PR은 쓰기 인증 대기 중입니다.

### [x] T1.2 경로
- 읽을 문서: 02 (2~3절)
- 할 일: `src/sim/path.ts` (A*, 폴리라인, 누적 길이, `positionAt(dist, segHint)`), `tests/sim/path.test.ts`.
- 완료 조건: stage-1 경로 기대값 테스트가 통과합니다.
- 검증 (2026-10-06): 결정론 A*와 지상/비행 폴리라인, 누적 길이 및 구간 힌트 보간 구현, check/lint/test/build 통과.
  경로 테스트 27개로 stage-1 지상 길이 16·비행 길이 √104, 경유점·동점·구간 경계·이동 실패를 확인했습니다.
  `t1.2-path` 로컬 브랜치 완료, 원격 PR은 쓰기 인증 대기 중입니다.

### [x] T1.3 Battle 코어 (스폰·이동·누수·승패)
- 읽을 문서: 01 (3절), 02 (1, 6, 12~18절)
- 할 일
  - `sim/types.ts`, `constants.ts`, `battle.ts` (createBattle, enqueue, flush, step, 14절 순서의 골격).
  - `systems/spawn.ts`, `movement.ts`, `death.ts`, `outcome.ts`, `hash.ts`.
  - `tests/helpers.ts`의 `laneStage`, `run`.
  - `tests/sim/outcome.test.ts`.
- 완료 조건: stage-1의 총 예정 적은 21마리이며, 기본 목숨 3에서 아무것도 배치하지 않으면 세 번 누수 후 즉시 패배합니다.
  전체 21마리의 스폰·경로 이동은 목숨을 21로 복제한 테스트 스테이지에서 확인합니다.
- 검증 (2026-10-06): 30Hz Battle 상태와 스폰·이동·적 사망·누수·승패·상태 해시 구현.
  check/lint/test/build 통과, 전체 12개 파일 208개 테스트 통과.
  실제 stage-1은 6마리 스폰·3누수 후 tick 804에 패배하며 이후 tick과 상태 해시가 고정됩니다.
  목숨 21/30인 별도 검증에서 전체 21마리 이동 후 패배/승리, 종료 이벤트 1회 및 같은 seed의 반복 실행을 확인했습니다.
  프로덕션 미리보기의 `/mallang-guard/` 경로에서도 보드·CSS·콘텐츠 청크가 모두 로드되고 브라우저 오류가 없었습니다.
  명령 큐는 골격만 준비했으며 배치·후퇴·공격·DP 처리와 조회 API는 T1.4에서 연결합니다. 화면의 적 표시는 T1.5 범위입니다.
  `t1.3-battle-core` 로컬 브랜치 완료, 원격 PR은 쓰기 인증 대기 중입니다.

### [x] T1.4 고지대 배치·자동 공격
- 읽을 문서: 02 (4~5, 7~9절)
- 할 일: `commands.ts`, `dp.ts`, `roster.ts`, `attack.ts`, `formulas.ts`, `stats.ts`(버프 없이 기본값), 조회 헬퍼 (`checkDeploy`, `rangeTilesFor`, `unitAt`, `rosterView`).
- 테스트: formulas, dp, deploy, defense, targeting, attack (07 문서).
- 완료 조건: 테스트에서 유닛을 배치하면 적을 막고 처치합니다.
- 검증 (2026-10-07): 조회 API와 명령 처리가 같은 배치 판정을 사용합니다. 배치·후퇴·DP·재배치·저지·기본 공격·회복·반격을 연결하고 28개 파일 438개 테스트 및 check/lint/build를 통과했습니다. 스킬·특성·버프는 T2.2 범위로 유지합니다.

### [x] T1.5 엔티티 뷰 (임시 그래픽)
- 읽을 문서: 04 (4, 6, 9절)
- 할 일
  - 유닛과 적을 **임시 그림**으로 그립니다: 역할색 원 + 이니셜 글자를 캔버스로 그려 텍스처로 씁니다.
  - 빌보드, 발밑 그림자, 적 위치 보간.
  - 오버레이 캔버스에 적 HP·아군 SP 바.
  - 앱 루프 (`src/app/loop.ts`, 01 문서 4절)와 `battleSession.ts` 연결.
- 완료 조건: 적이 부드럽게 이동하며 피해를 입으면 HP 바가 줄어듭니다. 친구는 높은 칸에 서고 SP 게이지를 표시합니다.
- 검증 (2026-10-07): 30Hz 루프·rAF 보간·일시정지 명령 처리를 전투 세션에 연결했습니다. 역할색·이니셜 빌보드, 그림자, HP 바와 피격 표시를 구현했습니다. 읽기 전용 뷰와 리소스 정리 및 기존 438개 테스트·check/lint/build를 확인했습니다. 브라우저에서 기본 stage-1의 배치·저지·피해를 140틱까지 진행하고 오류·경고 0건을 확인했습니다.
  화면 확인: [1920×1080](../verification/t1.5-desktop.png), [844×390](../verification/t1.5-mobile.png).

### [x] T1.6 입력 (배치·방향·선택)
- 읽을 문서: 05 (4절), 04 (8, 10절)
- 할 일
  - `picking.ts`(+ 테스트), `highlights.ts`, `controller.ts` 상태 머신.
  - 임시 카드 목록(이름 + 비용 버튼)으로 드래그 배치, 방향 조준, 사거리 미리보기, 유닛 선택 후 후퇴.
- 완료 조건: 마우스와 터치(브라우저 개발자도구 모바일 에뮬레이션)로 stage-1을 처음부터 끝까지 플레이할 수 있습니다.
- 검증 (2026-10-07): 카드 드래그, 배치 가능 칸·고스트·사거리, 방향 버튼·조준 드래그·키보드 확정, 선택·후퇴를 연결했습니다. 임시 HUD의 도토리·재배치·전투 현황·일시정지·배속·결과 표시와 터치 세로 회전 안내도 동작합니다. 후퇴 환급 표시는 실제 상한을 반영하고 적 쿨다운은 저지 해제 중에도 진행합니다.
  check/lint/test/build 및 31개 파일 447개 테스트 통과. PC 마우스와 모바일 실제 터치 이벤트로 각각 21/21 처치·푸딩 3개 유지 승리, 브라우저 오류·경고 0건을 확인했습니다. 키보드·조준 드래그·Esc·터치 취소·멀티터치도 별도로 확인했습니다.
  화면 확인: [PC 전투](../verification/t1.6-desktop.png), [모바일 전투](../verification/t1.6-mobile.png), [PC 조준](../verification/t1.6-desktop-aim.png), [모바일 조준](../verification/t1.6-mobile-aim.png), [PC 승리](../verification/t1.6-desktop-clear.png), [모바일 승리](../verification/t1.6-mobile-clear.png).

---

## M2 명일방주 코어

### [x] T2.1 로스터와 도토리 완성
- 읽을 문서: 02 (4~5절)
- 할 일: 배치 제한, 재배치 대기, 후퇴 환급, `rosterView()`의 카드 상태 (`ready` / `noDp` / `cooldown` + 남은 초).
- 완료 조건: deploy 테스트 전부 통과.
- 완료 확인 (2026-10-07): 고지대 수정에 포함된 배치 제한·후퇴 환급·재배치·로스터 조회를 기존 deploy/dp 테스트와 전체 456개 테스트로 확인했습니다.

### [x] T2.2 스킬과 상태이상
- 읽을 문서: 02 (8~11절), 03 (skills.json)
- 할 일
  - `skills.ts`, `status.ts`, `stats.ts`(버프 반영).
  - 효과 9종, 특성(traits).
  - 비행 적과 대공(`canHitAir`), 토끼의 주변 아군 공격 속도 지원.
- 테스트: skills, status (07 문서). 효과 9종 각각.
- 완료 조건: 8개 스킬이 모두 스펙대로 동작합니다.
- 고지대 디펜스 수정: 기존 체력·피격·저지와 이에 의존한 곰/토끼 스킬을 사용자 요청에 맞춰 교체했습니다. 02·03·05·07 문서를 현재 규칙으로 동기화했습니다.
- 검증: 아래 수정 검증 기록을 참고합니다.

### [x] T2.3 전투 HUD
- 읽을 문서: 05 (2~4절)
- 할 일: 상단 바, 배치 바(카드 상태 4종, 도토리 게이지), 유닛 패널(스킬 버튼, 후퇴), 토스트, 배속, 일시정지(일시정지 중 배치 포함), 슬로모션.
- 카드 초상화는 이 단계에서도 임시 그림을 써도 됩니다 (T3.1에서 교체).
- 완료 조건: 마우스만으로 모든 조작이 됩니다. 키보드 단축키도 동작합니다.
- 스킬 팝업 개선: 선택 유닛 옆 팝업·발동 알림·모바일 배치를 구현했습니다. 위 개선 기록을 참고합니다.
- 검증 (2026-10-07): 푸딩 감소·웨이브 변경 피드백, 배치 불가 카드 흔들림, 부족 비용·배치 제한·재배치 상태 표시와 한글 글꼴을 마무리했습니다. 기존 배치·스킬 검증 및 `tests/browser/hud.mjs`의 PC·모바일 HUD/배속/키보드 확인, check/lint/test/build(456개 테스트)가 통과했습니다. 일시정지 메뉴와 배속 저장은 T2.4에서 연결합니다.
  화면: [PC](../verification/t2.3-desktop.png), [모바일](../verification/t2.3-mobile.png), [PC 푸딩 감소](../verification/t2.3-desktop-critical.png), [모바일 푸딩 감소](../verification/t2.3-mobile-critical.png).

### [x] T2.4 화면 흐름과 저장
- 읽을 문서: 05 (1, 3, 7절)
- 할 일: 타이틀, 일시정지 메뉴, 결과 화면, 다시 시작, `dispose()`로 리소스 정리, `save.ts`.
- 완료 조건: 타이틀 → 전투 → 결과 → 다시 하기를 10번 반복해도 메모리(Three.js `renderer.info.memory`)가 늘지 않습니다.
- 검증 (2026-10-07): 타이틀·일시정지·정지 배치·승패 결과·새로고침 없는 재시작과 배속/최고 푸딩 기록 저장을 연결했습니다. PC·모바일 각 10회 반복 후 HUD·모달·입력 리스너·예약 프레임이 남지 않았습니다. 유닛/고스트를 포함한 세션 10회의 활성 GPU 자원은 매번 지오메트리 14·텍스처 5였고 종료 후 모두 0이었습니다.
- 저장소 예외·잘못된 기록 테스트, 세로 화면 중 메뉴 재개/정지 배치, 실제 PC·모바일 stage-1 승리(푸딩 3·처치 21)와 새로고침 후 기록 복원을 확인했습니다. check/lint/test/build, 34개 파일 467개 테스트 통과. 브라우저 오류·경고 0건.
  화면: [PC 타이틀](../verification/t2.4-desktop-title.png), [모바일 타이틀](../verification/t2.4-mobile-title.png), [PC 메뉴](../verification/t2.4-desktop-pause.png), [모바일 메뉴](../verification/t2.4-mobile-pause.png), [PC 승리](../verification/t2.4-desktop-clear.png), [모바일 승리](../verification/t2.4-mobile-clear.png), [PC 패배](../verification/t2.4-desktop-lost.png), [모바일 패배](../verification/t2.4-mobile-lost.png).

### [x] T2.5 골든 시나리오와 밸런스 1차
- 읽을 문서: 07 (2~4절)
- 할 일: `runScenario`, `stage-1-clear.json`, `stage-1-idle.json`, determinism 테스트. 시나리오가 통과하도록 배치나 수치를 다듬습니다.
- 완료 조건: 골든 시나리오는 승리, idle 시나리오는 패배합니다. 결정론 테스트가 통과합니다.
- 검증 (2026-10-07): 시나리오 JSON 전체 자동 실행, 명령 순서·재배치 uid·엄격한 실패 처리와 30틱 간격/종료 해시를 구현했습니다. 기본 배치는 2613틱(87.1초)에 21마리 처치·푸딩 3개·누수 0으로 승리하고, 무배치는 804틱(26.8초)에 3누수로 패배합니다. 수동 스킬을 추가한 실행과 일시정지 중 flush/일반 step도 동일한 해시·이벤트·최종 상태를 확인했습니다.
- 1차 기준을 만족하여 콘텐츠 수치는 유지합니다. check/lint/test/build, 37개 파일 498개 테스트 통과(신규 31개). 화면 변경 없이 테스트·명세만 추가했습니다.

---

## M3 귀여움 패스

### [x] T3.1 캐릭터 생성기와 텍스처
- 읽을 문서: 06 (1~3절), 04 (4~5절)
- 할 일
  - `src/art/critters.ts`(plan.html에서 이식 + hardJelly, pudding), `vfxArt.ts`, `palette.ts`.
  - `textures.ts` 굽기, 스프라이트 셰이더(uFlash, uTint), 임시 그림 교체, 카드·패널 초상화를 인라인 SVG로 교체.
- 완료 조건: 화면이 plan.html 목업의 캐릭터와 같은 그림체로 보입니다.
- 검증 (2026-10-07): 목업의 동물 8종·기존 적 2종 이식, 단단젤리·푸딩 및 이펙트 그림 10종을 추가했습니다. SVG 선로딩·세션별 GPU 자원·피격 셰이더·방향 반전과 타이틀/카드/팝업 초상화를 연결했습니다. check/lint/test/build(498개) 및 PC·모바일 22종 투명 이미지 로딩·배치 확인, 브라우저 오류·경고 0건.
  화면: [PC](../verification/t3.1-desktop.png), [모바일](../verification/t3.1-mobile.png), [PC 타이틀](../verification/t3.1-desktop-title.png), [모바일 타이틀](../verification/t3.1-mobile-title.png).

### [x] T3.2 애니메이션
- 읽을 문서: 06 (4절)
- 할 일: 애니메이션 상태 표 전부, 적의 기절·둔화 표시, reduced-motion 대응.
- 완료 조건: 모든 상태가 화면에서 확인됩니다 (짧은 녹화 GIF 또는 스크린샷 여러 장).
- 검증 (2026-10-07): 숨쉬기·배치 낙하/착지·공격 반동·지상 점프·비행·피격 플래시·스킬 링·사망/누수 축소를 연결했습니다. 기절 시 이동 동작이 멈추고 둔화·기절 색을 표시합니다. 모션 감소는 숨쉬기/낙하/반동을 생략하고 점프를 절반으로 줄입니다. 애니메이션 순수 함수 7개 검증과 PC·모바일의 정지 프레임 일치·상태별 스크린샷을 확인했습니다.
  화면: [PC 착지](../verification/t3.2-desktop-deploy.png), [PC 사용 중](../verification/t3.2-desktop-active.png), [PC 퇴장](../verification/t3.2-desktop-exit.png), [모바일 사용 중](../verification/t3.2-mobile-active.png).

### [x] T3.3 이펙트와 오버레이 완성
- 읽을 문서: 04 (7, 9절)
- 할 일: 투사체(유닛별 모양), 스파크, 응원, 스킬 파동, 둔화 웅덩이, 기절 별, 사망 방울, 누수 연출, 피해 숫자, 스킬 준비 말풍선. 파티클 풀링.
- 완료 조건: 이벤트 표의 모든 연출이 재생됩니다. 적 60마리 상황에서 데스크톱 60fps를 유지합니다.
- 검증 (2026-10-07): 투사체·피격/숫자 동기화·스킬 파동/응원·둔화/기절·사망 방울·누수 비네트와 준비 말풍선을 구현했습니다. 풀 200개 상한·소멸·원거리 사망 지연, PC/모바일 결과/재시작 각 10회 및 세션 GPU 자원 해제(0/0)를 확인했습니다. check/lint/test/build, 39개 파일 509개 테스트 통과.
- 성능: 적 60·아군 8, Intel Arc 130V에서 드로우콜 최대 33회·파티클 91개·렌더 CPU p95 1.6ms, 갱신 제한 없는 처리량 약 442fps. 일반 headless 화면은 빈 rAF부터 약 56fps이므로 실제 표시 60fps 여부는 이 환경에서 확인할 수 없습니다. 두 측정 모드를 구분해 기록하며 07 문서의 환경 기준을 적용합니다.
  화면: [PC 효과](../verification/t3.3-desktop-impact.png), [모바일 효과](../verification/t3.3-mobile-impact.png).

### [x] T3.4 보드 아트 패스
- 읽을 문서: 04 (2~3절)
- 할 일: 툰 재질, 덤불과 꽃, 고지대 하이라이트, 받침, 스폰 포털, 푸딩 골, 조명·그림자 조정.
- 완료 조건: plan.html 목업과 나란히 놓았을 때 같은 게임처럼 보입니다.
- 검증 (2026-10-07): 기존 툰 타일·덤불/꽃·고지대 하이라이트·흙 받침을 유지하고, 맥동하는 분홍 포털/나선 점과 원본 그림체의 푸딩 골을 추가했습니다. 누수 피드백·일시정지·모션 감소·복귀를 PC/모바일에서 검증했습니다. check/lint/test/build(509개 테스트), 브라우저 오류 0건.
  화면: [PC 정원](../verification/t3.4-desktop.png), [모바일 정원](../verification/t3.4-mobile.png), [누수 반응](../verification/t3.4-desktop-leak.png).

### [x] T3.5 효과음, 화면 흔들림, 품질 설정
- 읽을 문서: 06 (5절), 04 (11절)
- 할 일: `sfx.ts`, 볼륨 설정, 자동 품질 전환, 설정 메뉴(볼륨, 품질, 배속 기억).
- 완료 조건: 소리가 처음 입력 이후에만 나고, 설정이 저장됩니다.
- 검증 (2026-10-07): WebAudio 효과음 9종·첫 입력 후 활성화·중복 재생 제한·볼륨/음소거와 설정 메뉴를 연결했습니다. 품질/DPR/그림자/파티클·배속·OS 및 사용자 모션 설정을 즉시 적용하고 기존 저장 형식에 보관합니다. 누수 화면 흔들림을 추가하고 모션 감소에서는 끕니다. 3초 평균 40fps 미만 자동 품질 전환과 수동 선택 우선도 확인했습니다.
- PC·모바일 완주(21/21 처치·푸딩 3), 수동/자동 스킬 팝업·배치/취소·키보드·회전·저장 복원·재시작 각 10회가 통과했습니다. 작은 740×360 화면에서 발견한 스킬 버튼 잘림은 줄 높이를 조정해 44px 터치 영역을 유지하며 수정했습니다. 세션 GPU 자원은 매회 동일하고 해제 후 0/0, 오디오 컨텍스트는 앱당 하나·종료 후 닫힘을 확인했습니다.
- check/lint/test/build, 40개 파일 512개 테스트와 브라우저 검증 오류·경고 0건. 효과음/설정·전체 흐름의 회귀 스크립트와 화면을 저장했습니다.
- 최종 보드·효과·오버레이 포함 성능: 적 60·친구 8, 1920×1080에서 최대 48 draw calls·91 파티클, 렌더 CPU p95 1.4ms. 표시 모드 55.4fps(빈 rAF 56.2fps), 제한 없는 처리량 558fps이며 실제 표시 60fps 검증의 환경 한계는 T3.3 기록과 같습니다.
- 프로덕션 빌드의 `/mallang-guard/` 경로에서도 그림 8종·WebGL·설정·전투 진입을 확인했습니다. 로딩 오류·브라우저 경고 0건이며 공개 Pages 배포는 T0.3의 관리자 설정과 PR 병합 후 확인합니다.
  화면: [최종 PC](../verification/v0.1-desktop.png), [최종 모바일](../verification/v0.1-mobile.png), [PC 설정](../verification/t3.5-desktop-settings.png), [모바일 설정](../verification/t3.5-mobile-settings.png), [작은 화면 팝업 수정](../verification/v0.1-mobile-compact-popup.png).

---

### [x] T3.6 v0.1 구현 재점검
- 사용자 요청: 기존 구현을 다시 검사하고 발견한 오류를 재현한 뒤 수정합니다.
- 수정 (2026-10-08): 생성된 틱에 처치된 적의 모습·피격 연출이 사라지는 오류를 `enemySpawn` 위치 스냅샷으로 수정했습니다. 이벤트 생성자·소비자·직접 작성한 테스트 기대값을 함께 확인했습니다. 연속 원거리 공격은 피격 대기를 각각 보관해 앞선 효과를 취소하지 않습니다.
- 효과음도 화면 연출과 같은 시간으로 진행합니다. 도중에 정지·배속·선택 중 느린 시간이 바뀌어도 투사체 도착과 맞고, 메뉴 재개 시 대기 소리를 유지하며 재시작/타이틀에서는 정리합니다. 선택 중 전투가 끝났을 때 종료 징글이 늦게 재생되던 경우도 같은 시간 기준을 적용했습니다.
- 검증: 수정 전 실패한 캐릭터 경계 테스트 2개와 브라우저 효과음 시간 테스트가 수정 후 통과했습니다. check/lint/test/build, 41개 파일 514개 테스트 통과. `effects`, `audio`, `audioTiming`, `input`, `skillPopover`, `settings`, `appFlow`, `sessionResources` 브라우저 검사도 통과했습니다.
- PC·모바일 모두 푸딩 3개·21/21 처치 완주, 수동/자동 스킬 팝업, 설정 저장/복원, 10회 화면 전환·재시작을 확인했습니다. 세션 10회에서 활성 GPU 자원은 매번 지오메트리 51·텍스처 26, 종료 후 0/0입니다. 입력 리스너가 누적되지 않고 타이틀 복귀 후 예약 프레임이 남지 않으며, 브라우저 오류도 없습니다.
  화면: [PC 즉시 처치](../verification/review-desktop-instant-kill.png), [모바일 즉시 처치](../verification/review-mobile-instant-kill.png), [PC 피격](../verification/review-desktop-impact.png), [모바일 피격](../verification/review-mobile-impact.png), [PC 완주](../verification/review-desktop-clear.png), [모바일 완주](../verification/review-mobile-clear.png).

---

## M4 콘텐츠 (시작 전에 상세 스펙을 따로 씁니다)

- 스테이지 2~6: 갈림길(경로 여러 개), `path` 전용 칸, 스폰 여러 곳
- 새 적: 분열젤리(죽으면 작은 젤리 둘), 침뱉는젤리(원거리로 유닛 공격 → 뚜껑곰 도발 재검토), 보스
- 별 3개 평가, 스테이지 선택 화면, 진행 저장
- Playwright 스모크 테스트

## M5 확장 (방향만 정해 둠)

- 모바일 성능 최적화, PWA(오프라인 실행)
- 일러스트·Spine 교체 검토 (artId 단위로 교체 가능한 구조 유지)
- 로그라이크 모드
