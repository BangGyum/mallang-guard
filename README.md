# 말랑방위대 (mallang-guard)

명일방주식 배치 디펜스를 웹에서. 말랑한 동물들이 간식 창고(푸딩)를 노리는 말썽젤리를 온몸으로 막는 게임입니다.

- 캐릭터를 길(지상)과 고지대에 배치하고 방향을 정합니다. 근접 캐릭터는 적을 막고(블록), 캐릭터마다 스킬이 하나씩 있습니다.
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

## 개발 환경

개발·CI는 Node.js 24를 사용합니다 (`.nvmrc`).

```bash
npm ci
npm run dev
```

개발 서버 주소는 터미널에 출력됩니다. 현재 브라우저에는 산업지대 팔레트의 stage-1 정적 보드가 표시됩니다. 전투 코어의 스폰·이동·누수·승패는 화면 없이 테스트할 수 있습니다. 배치·공격은 T1.4, 전투 뷰와 루프 연결은 T1.5에서 추가합니다.

```bash
npm run check
npm run lint
npm test
npm run build
npm run preview
```

빌드 미리보기는 `/mallang-guard/` 경로에서 확인합니다. `npm test`로 전투 코어·콘텐츠·지상/비행 경로·보드·카메라 피팅·좌표·사거리·난수·수학 유틸과 레이어 의존성 규칙을 검증합니다. 테스트 파일이 없으면 실패합니다.

## GitHub Pages 배포

`main`에 push되면 타입·린트·테스트·빌드 검사 후 `dist/`를 Pages에 배포합니다. Actions의 **Deploy GitHub Pages → Run workflow**로 재시도할 수 있습니다.

저장소 관리자가 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 먼저 선택해야 합니다. 그다음 PR을 `main`에 병합합니다. 배포 완료 후 [공개 페이지](https://banggyum.github.io/mallang-guard/)를 확인합니다.

## 문서

- [`docs/spec/`](docs/spec/README.md): **구현 스펙.** 아키텍처, 전투 규칙, 데이터, 렌더링, UI, 아트, 테스트, 작업 티켓
- [`AGENTS.md`](AGENTS.md): 코딩 에이전트 작업 규칙
- [`docs/plan.html`](docs/plan.html): 기획 노트. 레퍼런스 조사, 캐릭터 컨셉, 엔진 비교 (브라우저로 열기)
- [`docs/references.html`](docs/references.html): 레퍼런스 게임 스크린샷 모아보기 (브라우저로 열기)

## 비주얼 시안

동물 귀를 남긴 인간형 전술 대원, 회색 산업지대, 각진 HUD를 적용한 첫 방향성 시안입니다. 전장에서는 SD 캐릭터, 배치 카드에서는 애니메이션풍 초상을 사용합니다.

![전술 디펜스 전투 화면 시안](docs/concepts/battle-screen-v1.png)

- [생성 프롬프트](docs/concepts/battle-screen-v1.prompt.txt): 내장 ImageGen으로 생성했습니다.
- T0.4부터 보드의 산업지대 색상·배경에 반영했습니다. 맵·전투 수치와 코드 기반 캐릭터 생성 방식은 유지합니다.

## 로드맵

진행 상황과 티켓별 완료 조건은 [`docs/spec/08-tasks.md`](docs/spec/08-tasks.md)에서 관리합니다.

- M0 세팅: Vite, TS, Three.js, Vitest, Pages 자동 배포
- M1 그레이박스 전투: 타일맵, 적 경로, 배치·방향, 저지, 기본 공격
- M2 명일방주 코어: 도토리 비용, 배치 제한, 후퇴·재배치, SP·스킬, 2배속
- M3 귀여움 패스: 캐릭터 생성기, 스쿼시 애니메이션, 툰 셰이딩, 타격감
- M4 콘텐츠: 스테이지 2~6, 새 적, 별 평가, 저장
- M5 확장: 모바일 최적화, 일러스트·Spine 검토
