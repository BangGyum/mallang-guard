# 08. 작업 티켓

**규칙**
- 위에서부터 순서대로 하나씩 진행합니다. 한 티켓 = 한 브랜치 = 한 PR (브랜치 이름 예: `t1.3-battle-core`).
- 티켓을 끝내면 이 파일의 체크박스를 체크합니다.
- **완료 조건**에는 항상 `npm run check`, `npm run lint`, `npm test`, `npm run build`가 모두 통과하는 것이 포함됩니다 (아래에서 반복하지 않음).
- 화면이 바뀌는 티켓은 PR에 스크린샷을 붙입니다 (07 문서 5절).
- 스펙과 다르게 구현해야 했다면 같은 PR에서 스펙 문서를 고치고, PR 설명에 이유를 씁니다.

---

## 병합 검증 (2026-10-07)

- `origin/t1.3-battle-core`의 별도 구현을 병합했습니다. 원격 전투·경로·콘텐츠 API, 유닛 사망 처리, CI 설정을 반영했습니다.
- 실제 동물·파스텔 정원 방향과 새 시안은 유지하고 카메라 피팅 및 PCF 그림자 개선을 적용했습니다.
- 로컬 회귀 사례와 원격 추가 검증을 함께 유지했습니다. `npm ci`, check/lint/test/build 및 22개 파일의 403개 테스트가 통과했습니다.
- 화면 확인: [1920×1080](../verification/merge-2026-10-07-desktop.png), [844×390](../verification/merge-2026-10-07-mobile.png).
- 아래 2026-10-06 기록은 각 로컬 티켓의 당시 검증 결과입니다. 현재 경로 API는 `buildRoute`/`Polyline.length`, 웨이브는 `state.currentWave`/`state.totalWaves`입니다.

## M0 세팅

### [ ] T0.1 프로젝트 생성
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

### [x] T1.4 배치·저지·공격
- 읽을 문서: 02 (4~5, 7~9절)
- 할 일: `commands.ts`, `dp.ts`, `roster.ts`, `block.ts`, `attack.ts`, `enemyAttack.ts`, `formulas.ts`, `stats.ts`(버프 없이 기본값), 조회 헬퍼 (`checkDeploy`, `rangeTilesFor`, `unitAt`, `rosterView`).
- 테스트: formulas, dp, deploy, block, targeting, attack (07 문서).
- 완료 조건: 테스트에서 유닛을 배치하면 적을 막고 처치합니다.
- 검증 (2026-10-07): 조회 API와 명령 처리가 같은 배치 판정을 사용합니다. 배치·후퇴·DP·재배치·저지·기본 공격·회복·반격을 연결하고 28개 파일 438개 테스트 및 check/lint/build를 통과했습니다. 스킬·특성·버프는 T2.2 범위로 유지합니다.

### [x] T1.5 엔티티 뷰 (임시 그래픽)
- 읽을 문서: 04 (4, 6, 9절)
- 할 일
  - 유닛과 적을 **임시 그림**으로 그립니다: 역할색 원 + 이니셜 글자를 캔버스로 그려 텍스처로 씁니다.
  - 빌보드, 발밑 그림자, 적 위치 보간.
  - 오버레이 캔버스에 HP 바.
  - 앱 루프 (`src/app/loop.ts`, 01 문서 4절)와 `battleSession.ts` 연결.
- 완료 조건: 적이 부드럽게 이동하고, 저지되면 멈추고, 맞으면 HP 바가 줄어듭니다.
- 검증 (2026-10-07): 30Hz 루프·rAF 보간·일시정지 명령 처리를 전투 세션에 연결했습니다. 역할색·이니셜 빌보드, 그림자, HP 바와 피격 표시를 구현했습니다. 읽기 전용 뷰와 리소스 정리 및 기존 438개 테스트·check/lint/build를 확인했습니다. 브라우저에서 기본 stage-1의 배치·저지·피해를 140틱까지 진행하고 오류·경고 0건을 확인했습니다.
  화면 확인: [1920×1080](../verification/t1.5-desktop.png), [844×390](../verification/t1.5-mobile.png).

### [ ] T1.6 입력 (배치·방향·선택)
- 읽을 문서: 05 (4절), 04 (8, 10절)
- 할 일
  - `picking.ts`(+ 테스트), `highlights.ts`, `controller.ts` 상태 머신.
  - 임시 카드 목록(이름 + 비용 버튼)으로 드래그 배치, 방향 조준, 사거리 미리보기, 유닛 선택 후 후퇴.
- 완료 조건: 마우스와 터치(브라우저 개발자도구 모바일 에뮬레이션)로 stage-1을 처음부터 끝까지 플레이할 수 있습니다.

---

## M2 명일방주 코어

### [ ] T2.1 로스터와 도토리 완성
- 읽을 문서: 02 (4~5절)
- 할 일: 배치 제한, 재배치 대기, 후퇴 환급, `rosterView()`의 카드 상태 (`ready` / `noDp` / `cooldown` + 남은 초).
- 완료 조건: deploy 테스트 전부 통과.

### [ ] T2.2 스킬과 상태이상
- 읽을 문서: 02 (8~11절), 03 (skills.json)
- 할 일
  - `skills.ts`, `status.ts`, `stats.ts`(버프 반영).
  - 효과 10종, 특성(traits).
  - 비행 적과 대공(`canHitAir`), 메딕 회복 타겟팅.
- 테스트: skills, status (07 문서). 효과 10종 각각.
- 완료 조건: 8개 스킬이 모두 스펙대로 동작합니다.

### [ ] T2.3 전투 HUD
- 읽을 문서: 05 (2~4절)
- 할 일: 상단 바, 배치 바(카드 상태 4종, 도토리 게이지), 유닛 패널(스킬 버튼, 후퇴), 토스트, 배속, 일시정지(일시정지 중 배치 포함), 슬로모션.
- 카드 초상화는 이 단계에서도 임시 그림을 써도 됩니다 (T3.1에서 교체).
- 완료 조건: 마우스만으로 모든 조작이 됩니다. 키보드 단축키도 동작합니다.

### [ ] T2.4 화면 흐름과 저장
- 읽을 문서: 05 (1, 3, 7절)
- 할 일: 타이틀, 일시정지 메뉴, 결과 화면, 다시 시작, `dispose()`로 리소스 정리, `save.ts`.
- 완료 조건: 타이틀 → 전투 → 결과 → 다시 하기를 10번 반복해도 메모리(Three.js `renderer.info.memory`)가 늘지 않습니다.

### [ ] T2.5 골든 시나리오와 밸런스 1차
- 읽을 문서: 07 (2~4절)
- 할 일: `runScenario`, `stage-1-clear.json`, `stage-1-idle.json`, determinism 테스트. 시나리오가 통과하도록 배치나 수치를 다듬습니다.
- 완료 조건: 골든 시나리오는 승리, idle 시나리오는 패배합니다. 결정론 테스트가 통과합니다.

---

## M3 귀여움 패스

### [ ] T3.1 캐릭터 생성기와 텍스처
- 읽을 문서: 06 (1~3절), 04 (4~5절)
- 할 일
  - `src/art/critters.ts`(plan.html에서 이식 + hardJelly, pudding), `vfxArt.ts`, `palette.ts`.
  - `textures.ts` 굽기, 스프라이트 셰이더(uFlash, uTint), 임시 그림 교체, 카드·패널 초상화를 인라인 SVG로 교체.
- 완료 조건: 화면이 plan.html 목업의 캐릭터와 같은 그림체로 보입니다.

### [ ] T3.2 애니메이션
- 읽을 문서: 06 (4절)
- 할 일: 애니메이션 상태 표 전부, 저지된 적 화면 퍼뜨리기, reduced-motion 대응.
- 완료 조건: 모든 상태가 화면에서 확인됩니다 (짧은 녹화 GIF 또는 스크린샷 여러 장).

### [ ] T3.3 이펙트와 오버레이 완성
- 읽을 문서: 04 (7, 9절)
- 할 일: 투사체(유닛별 모양), 스파크, 회복, 스킬 파동, 둔화 웅덩이, 기절 별, 사망 방울, 누수 연출, 피해 숫자, 스킬 준비 말풍선. 파티클 풀링.
- 완료 조건: 이벤트 표의 모든 연출이 재생됩니다. 적 60마리 상황에서 데스크톱 60fps를 유지합니다.

### [ ] T3.4 보드 아트 패스
- 읽을 문서: 04 (2~3절)
- 할 일: 툰 재질, 덤불과 꽃, 고지대 하이라이트, 받침, 스폰 포털, 푸딩 골, 조명·그림자 조정.
- 완료 조건: plan.html 목업과 나란히 놓았을 때 같은 게임처럼 보입니다.

### [ ] T3.5 효과음, 화면 흔들림, 품질 설정
- 읽을 문서: 06 (5절), 04 (11절)
- 할 일: `sfx.ts`, 볼륨 설정, 자동 품질 전환, 설정 메뉴(볼륨, 품질, 배속 기억).
- 완료 조건: 소리가 처음 입력 이후에만 나고, 설정이 저장됩니다.

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
