# AGENTS.md

코딩 에이전트(GPT/Codex, Claude 등)가 이 레포에서 작업할 때 따르는 규칙입니다.

## 프로젝트

**말랑방위대**: 명일방주식 배치 디펜스를 귀여운 동물 캐릭터로 만드는 웹 게임입니다. TypeScript + Three.js(2.5D) + Vite로 만듭니다.
기획 배경은 `docs/plan.html`, 구현 스펙은 `docs/spec/`에 있습니다.

## 작업 시작 전에

1. `docs/spec/README.md`를 읽습니다. 목차, **확정된 결정**, 용어가 있습니다.
2. `docs/spec/08-tasks.md`에서 체크되지 않은 가장 위의 티켓을 고릅니다. 사람이 다른 티켓을 지정하면 그걸 따릅니다.
3. 티켓의 "읽을 문서"를 읽습니다. `01-architecture.md`는 항상 읽습니다.

스펙과 기존 코드가 다르면 **스펙이 우선**입니다. 스펙이 모호하면 가장 단순한 해석으로 진행하고, `docs/spec/open-questions.md`와 PR 설명에 적습니다.

## 명령어

```bash
npm install
npm run dev        # 개발 서버
npm run check      # 타입 검사
npm run lint       # Biome
npm test           # Vitest
npm run build      # 프로덕션 빌드 (dist/)
```

## 반드시 지킬 것

- **레이어 규칙** (`docs/spec/01-architecture.md` 1절)
  - `src/sim`은 `three`, DOM, `Math.random`, `Date`, `performance`를 쓰지 않습니다.
  - view와 ui는 sim 상태를 직접 바꾸지 않고 `battle.enqueue(command)`만 씁니다.
  - `tests/architecture.test.ts`가 이를 검사합니다. 테스트를 고쳐서 통과시키지 않습니다.
- **수치는 데이터에.** 밸런스 숫자는 `src/data/*.json`, 규칙 상수는 `src/sim/constants.ts`에만 둡니다.
- **결정론.** 타이머는 정수 틱으로 셉니다. 엔티티는 uid 순서로 순회하고, 정렬 동점은 uid로 깹니다.
- **테스트.** sim 규칙을 더하거나 바꾸면 테스트를 같이 씁니다. 필수 목록은 `docs/spec/07-testing.md`에 있습니다.
- **완료 조건.** `check`, `lint`, `test`, `build`가 모두 통과해야 합니다. 화면이 바뀌면 스크린샷을 남깁니다.
- **스펙 동기화.** 구현이 스펙과 달라지면 같은 변경에서 스펙 문서도 고칩니다. 티켓을 끝내면 `08-tasks.md`의 체크박스를 체크합니다.

## 코드 스타일

- TypeScript strict. `any`는 쓰지 않습니다 (꼭 필요하면 `unknown` + 좁히기).
- 앱 코드와 테스트는 named export만 씁니다. 도구에서 요구하는 `vite.config.ts`의 default export만 예외입니다.
- 파일 이름은 camelCase, 타입은 PascalCase, 상수는 UPPER_SNAKE_CASE를 씁니다.
- 한 파일이 300줄을 넘으면 쪼갭니다.
- 주석은 "왜"가 필요한 곳에만 짧게 씁니다. 한국어도 괜찮습니다.
- 게임 안 문구(UI 텍스트)는 한국어, 코드 식별자는 영어입니다.

## 의존성

허용 목록은 `three`, `vite`, `typescript`, `@types/three`, `vitest`, `@biomejs/biome`, 그리고 선택 사항인 `playwright`(devDependency)입니다.
그 밖의 패키지를 추가하려면 PR 설명에 이유를 쓰고 사람의 확인을 받습니다. UI 프레임워크와 게임 엔진은 추가하지 않습니다.

## 에셋과 저작권

- 캐릭터와 이펙트 그림은 `src/art`의 코드 생성기로 만듭니다.
- 다른 게임(명일방주 등)의 이미지, 사운드, UI, 고유 명칭을 가져오지 않습니다. 구조와 규칙만 참고합니다.
- 외부 에셋이 꼭 필요하면 CC0만 쓰고, 출처를 `docs/ASSETS.md`에 기록합니다.

## Git

- 한 티켓 = 한 브랜치 = 한 PR. 브랜치 이름은 `t1.3-battle-core` 형식입니다.
- 커밋 메시지는 영어 명령문 또는 한국어로 짧게 씁니다. 예: `Add block system`, `저지 시스템 추가`.
- 레포 로컬 git 설정(작성자, 자격 증명)은 이미 되어 있습니다. 바꾸지 않습니다.
- main에 force push하지 않습니다.
- 레포 설정(Pages, 권한, 시크릿)은 사람이 바꿉니다. 필요하면 PR 설명에 적습니다.
