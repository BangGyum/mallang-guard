# 말랑방위대 (mallang-guard)

명일방주식 배치 디펜스를 웹에서. 말랑한 동물들이 간식 창고(푸딩)를 노리는 말썽젤리를 높은 지형에서 막는 게임입니다.

- 캐릭터를 보라색 고지대에 배치하고 방향을 정하면 경로의 적을 자동 공격합니다. 아군에게 체력이나 피격은 없으며, 캐릭터마다 스킬이 하나씩 있습니다.
- 배치 비용은 시간이 지나면 쌓이는 **도토리**, 지켜야 할 목숨은 **푸딩 3개**입니다.

## 기술 방향

| 영역 | 선택 |
| --- | --- |
| 언어 | TypeScript |
| 렌더링 | Three.js. 3D 타일 디오라마 위에 2D 캐릭터를 세우는 2.5D |
| UI | DOM 오버레이 |
| 빌드 | Vite |
| 테스트 | Vitest. 전투 시뮬레이션을 화면 없이 검증 |
| 배포 | GitHub Pages |

전투 규칙(`src/sim`)은 렌더러를 모르는 순수 TS로 작성합니다. 초당 30틱 고정에 시드 기반 난수를 쓰므로 같은 입력이면 항상 같은 결과가 나옵니다.

## 개발 실행

Node.js 24와 npm을 사용합니다 (`.nvmrc`: `24`). 고지대 디펜스와 캐릭터별 스킬을 브라우저에서 플레이할 수 있습니다.
카드를 고지대에 끌어 놓고 방향을 고릅니다. 자동 공격·SP 충전·스킬 8종과 도토리·후퇴·재배치가 동작합니다.
원본 목업의 동물 그림과 푸딩·포털, 배치/공격/스킬 애니메이션, 투사체·피해 숫자·상태이상 효과를 연결했습니다.
타이틀 또는 일시정지 메뉴의 설정에서 효과음·품질·배속·움직임을 변경하고 저장할 수 있습니다. 소리는 첫 입력 후 켜집니다.

```bash
npm install
npm run dev        # 개발 서버. 터미널에 표시된 주소로 접속
npm run check      # TypeScript 타입 검사
npm run lint       # Biome 검사
npm test           # Vitest 실행
npm run build      # 타입 검사 후 dist/에 프로덕션 빌드
npm run preview    # dist/ 빌드 결과 확인
```

방향 버튼을 누르거나 칸 중심에서 끌어 방향을 정합니다. 화살표 키와 Enter로도 확정할 수 있고, Esc는 취소합니다.
배치한 친구의 칸을 누르면 스킬·후퇴 패널이 열립니다. 준비된 스킬의 발동 버튼을 누르면 사용할 수 있고, 토끼의 공격 속도 지원 스킬은 자동 발동합니다. Space는 일시정지, 1/2는 배속입니다. 터치 기기의 세로 화면에서는 자동으로 멈추고 회전 안내를 표시합니다.

개발 서버와 Microsoft Edge가 있는 환경에서는 `node tests/browser/input.mjs`로 PC 마우스와 모바일 터치의 고지대 배치·후퇴·스킬 발동·완주를, `node tests/browser/inputEdges.mjs`로 키보드·조준 드래그·취소·멀티터치를 검증합니다. 완주 검증은 100ms 프레임으로 구동해 고정 틱 처리를 확인하며, FPS 성능 측정은 아닙니다.

`npm test`로 core 유틸·콘텐츠 검증·경로·전투 코어·카메라 피팅과 레이어 의존 규칙을 검증합니다. 테스트 파일이 없으면 실패합니다.
push와 pull request에서는 Node.js 24로 `npm ci → check → lint → test → build`를 순서대로 실행합니다.

## GitHub Pages 배포

저장소의 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.
이 설정은 저장소 관리자가 적용합니다. 이후 `main`에 push하면 검사와 빌드를 통과한 `dist/`를 배포합니다.
배포 주소는 <https://banggyum.github.io/mallang-guard/>이며, 실제 배포 확인은 관리자 Pages 설정과 구현 PR 병합 후 진행합니다.

## 문서

- [`docs/spec/`](docs/spec/README.md): **구현 스펙.** 아키텍처, 전투 규칙, 데이터, 렌더링, UI, 아트, 테스트, 작업 티켓
- [`AGENTS.md`](AGENTS.md): 코딩 에이전트 작업 규칙
- [`docs/plan.html`](docs/plan.html): 기획 노트. 레퍼런스 조사, 캐릭터 컨셉, 엔진 비교 (브라우저로 열기)
- [`docs/references.html`](docs/references.html): 레퍼런스 게임 스크린샷 모아보기 (브라우저로 열기)

## 비주얼 시안

현재 방향은 실제 귀여운 동물, 산뜻한 파스텔 정원, 고지대 자동 공격과 스킬 중심의 디펜스입니다. 그림은 방향성 참고용이며 실제 화면은 Three.js 타일과 코드로 생성한 캐릭터를 사용합니다.

![산뜻한 동물 전투 시안](docs/concepts/battle-screen-v2-fresh.png)

- [새 시안 생성 프롬프트](docs/concepts/battle-screen-v2-fresh.prompt.txt)
- 아래 산업지대 이미지는 이전 시안으로 보존합니다.

![전술 디펜스 전투 화면 시안](docs/concepts/battle-screen-v1.png)

- [생성 프롬프트](docs/concepts/battle-screen-v1.prompt.txt): 내장 ImageGen으로 생성했습니다.
- 이 이미지는 검토용 시안이며, 기존 구현 스펙의 확정 사항을 변경한 것은 아닙니다.

## 로드맵

진행 상황과 티켓별 완료 조건은 [`docs/spec/08-tasks.md`](docs/spec/08-tasks.md)에서 관리합니다.

- M0 세팅: Vite, TS, Three.js, Vitest, Pages 자동 배포
- M1 그레이박스 전투: 타일맵, 적 경로, 고지대 배치·방향, 자동 공격
- M2 명일방주 코어: 도토리 비용, 배치 제한, 후퇴·재배치, SP·스킬, 2배속
- M3 귀여움 패스: 캐릭터 생성기, 스쿼시 애니메이션, 툰 셰이딩, 타격감
- M4 콘텐츠: 스테이지 2~6, 새 적, 별 평가, 저장
- M5 확장: 모바일 최적화, 일러스트·Spine 검토
