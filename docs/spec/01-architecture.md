# 01. 아키텍처

## 1. 레이어와 의존 방향

```
            ┌──────────────┐
            │  src/data    │  콘텐츠 JSON + 타입 + 검증
            └──────┬───────┘
                   │ ContentDb (읽기 전용)
            ┌──────▼───────┐        Command (배치·후퇴·스킬)
            │  src/sim     │ ◀──────────────────────────────┐
            │  전투 규칙    │                                 │
            └──────┬───────┘                                 │
         state(읽기) + SimEvent[]                             │
          ┌────────┴─────────┐                               │
   ┌──────▼──────┐    ┌──────▼──────┐                 ┌──────┴──────┐
   │  src/view   │    │  src/ui     │ ─── 입력 ─────▶ │ controller  │
   │  Three.js   │    │  DOM HUD    │                 │ (src/ui)    │
   └─────────────┘    └─────────────┘                 └─────────────┘
          ▲                  ▲
          └──── src/app (루프·화면 전환이 전부를 연결) ────┘
```

**의존 규칙.** 위반하면 `tests/architecture.test.ts`가 실패하게 만듭니다.

| 폴더 | import 가능 | import 금지 |
| --- | --- | --- |
| `src/core` | `src/core` | 그 외 전부, `three`, DOM API |
| `src/data` | `src/core`, `src/data` | `src/sim`, `src/view`, `src/ui`, `three` |
| `src/sim` | `src/core`, `src/data/types.ts`, `src/sim` | `three`, `src/view`, `src/ui`, `src/app`, DOM(`window`, `document`), `Math.random`, `Date`, `performance` |
| `src/art` | `src/core`, `src/art` | `three`, `src/sim` |
| `src/view` | `three`, `src/core`, `src/data`, `src/sim`(타입·읽기 전용 조회) | `src/ui`, `src/art` (앱이 구운 이미지 전달) |
| `src/ui` | DOM, `src/core`, `src/data`, `src/sim`(타입·Command), `src/art`, `src/view`(picking 등 공개 함수만) | sim 상태 직접 수정 |
| `src/app` | 전부 | — |
| `src/audio` | WebAudio, `src/sim` 이벤트 타입 | sim 상태 수정 |

- view와 ui는 sim 상태를 **읽기만** 합니다. 바꾸는 방법은 `battle.enqueue(command)` 하나뿐입니다.
- sim은 화면이 있는지조차 모릅니다. 그래서 Node(Vitest)에서 그대로 돌릴 수 있어야 합니다.
- 앱이 설정 저장·OS 모션 설정·오디오 이벤트를 연결합니다. UI는 설정 값을 콜백으로 전달하며, view/overlay는 품질과 확정된 모션 감소 값만 받습니다. 전투 종료 후 0.65초 동안 마지막 연출을 진행한 뒤 결과 화면으로 전환합니다.

## 2. 폴더 구조

```
mallang-guard/
├─ index.html                  #app 안에 board 캔버스, overlay 캔버스, hud 레이어
├─ public/                     파비콘 등
├─ src/
│  ├─ main.ts                  진입점: 콘텐츠 검증 → 텍스처 굽기 → App 시작
│  ├─ app/
│  │  ├─ app.ts                화면 전환: title → battle → result
│  │  ├─ battleSession.ts      Battle + BoardView + Overlay + Hud + Controller 연결
│  │  ├─ loop.ts               고정 틱 루프, 배속, 일시정지, 슬로모션
│  │  └─ save.ts               localStorage (모든 접근 try/catch)
│  ├─ core/                    순수 유틸 (DOM·three 금지)
│  │  ├─ grid.ts               Dir, 방향 회전, 사거리 타일 계산
│  │  ├─ rng.ts                mulberry32
│  │  ├─ math.ts               clamp, lerp, dist 등
│  │  └─ assert.ts
│  ├─ data/
│  │  ├─ types.ts              콘텐츠 타입 (03 문서)
│  │  ├─ validate.ts           raw JSON → ContentDb, 실패 시 경로 포함 에러
│  │  ├─ index.ts              JSON import + validate → `content` export
│  │  ├─ units.json  enemies.json  skills.json  ranges.json
│  │  └─ stages/stage-1.json
│  ├─ sim/
│  │  ├─ constants.ts          규칙 상수 (02 문서 15절)
│  │  ├─ types.ts              BattleState, 엔티티, Command, SimEvent
│  │  ├─ battle.ts             createBattle(), Battle 클래스
│  │  ├─ board.ts              맵 파싱, 타일 종류, 배치 가능 판정
│  │  ├─ path.ts               A*, 경로 폴리라인, dist → 좌표
│  │  ├─ formulas.ts           피해 계산
│  │  ├─ stats.ts              버프 적용 후 실제 스탯
│  │  ├─ hash.ts               테스트용 상태 해시
│  │  └─ systems/              틱 순서대로 한 파일씩
│  │     ├─ commands.ts  dp.ts  roster.ts  spawn.ts  status.ts  movement.ts
│  │     └─ skills.ts  attack.ts  damage.ts  death.ts  outcome.ts
│  ├─ view/
│  │  ├─ boardView.ts          씬 소유. render(state, alpha, dt), onEvents(events)
│  │  ├─ camera.ts             fitCamera() (순수 함수 부분 분리)
│  │  ├─ coords.ts             타일 좌표 ↔ 월드 좌표
│  │  ├─ tiles.ts              타일 InstancedMesh, 장식
│  │  ├─ sprites.ts            빌보드 메시 + 스프라이트 셰이더
│  │  ├─ entityViews.ts        uid ↔ 스프라이트, 애니메이션 상태
│  │  ├─ vfx.ts                투사체·파티클 연출 (풀링)
│  │  ├─ highlights.ts         배치 가능 칸, 사거리 표시
│  │  ├─ overlay.ts            2D 캔버스: 적 HP/아군 SP 바, 피해 숫자, 말풍선
│  │  ├─ picking.ts            화면 좌표 → 타일
│  │  └─ textures.ts           SVG → CanvasTexture 굽기, 캐시
│  ├─ ui/
│  │  ├─ dom.ts                h() 헬퍼
│  │  ├─ hud.ts                상단 바 (푸딩, 적 수, 웨이브, 배속, 일시정지)
│  │  ├─ deployBar.ts          배치 카드 + 도토리 표시
│  │  ├─ unitPanel.ts          선택 유닛 정보, 스킬 버튼, 후퇴
│  │  ├─ controller.ts         입력 상태 머신 (05 문서)
│  │  ├─ toast.ts  titleScreen.ts  resultScreen.ts  pauseMenu.ts
│  │  └─ styles.css
│  ├─ art/
│  │  ├─ palette.ts
│  │  ├─ critters.ts           critterSvg(artId): docs/plan.html 생성기 이식
│  │  └─ vfxArt.ts             이펙트용 작은 SVG (눈덩이, 별, 하트 등)
│  └─ audio/
│     └─ sfx.ts                WebAudio 합성 효과음 (M3)
└─ tests/
   ├─ architecture.test.ts
   ├─ data.test.ts
   ├─ helpers.ts               테스트용 콘텐츠·시나리오 실행기
   ├─ sim/*.test.ts
   ├─ view/*.test.ts           순수 함수만 (camera fit, picking 수학)
   └─ scenarios/stage-1-clear.json
```

- 파일 이름은 camelCase, 타입은 PascalCase, 상수는 UPPER_SNAKE_CASE를 씁니다.
- 앱 코드와 테스트에서 default export는 쓰지 않습니다. `vite.config.ts`는 Vite가 요구하는 default export를 씁니다.
- 한 파일이 300줄을 넘으면 쪼갭니다.

### core 유틸 API

`Dir`와 `Tile`은 `src/core/grid.ts`에서 한 번만 정의합니다. 사거리 오프셋은 콘텐츠의 `[dx, dy]` 튜플을 그대로 받습니다.

```ts
rotateOffset(offset: readonly [number, number], dir: Dir): [number, number];
rangeTiles(tile: Tile, offsets: readonly (readonly [number, number])[], dir: Dir, width: number, height: number): Tile[];
mulberry32(state: number): { state: number; value: number };
clamp(value: number, min: number, max: number): number;
lerp(from: number, to: number, alpha: number): number;
dist(ax: number, ay: number, bx: number, by: number): number;
assert(condition: unknown, message: string): asserts condition;
```

- `rangeTiles`는 오프셋 순서를 유지하고, 회전·이동 후 맵 밖 좌표를 제외합니다. 입력은 변경하지 않습니다.
- `mulberry32`는 숨겨진 상태 없이 다음 uint32 상태와 `[0, 1)` 난수를 반환합니다. 호출한 쪽에서 반환된 `state`를 저장합니다.
- `lerp`는 비율을 제한하지 않습니다. `dist`는 타일 단위 실수 위치 사이의 유클리드 거리입니다.

## 3. Battle API (sim의 공개 인터페이스)

```ts
// src/sim/battle.ts
export function createBattle(content: ContentDb, stageId: string, opts?: { seed?: number }): Battle;

export interface Battle {
  readonly content: ContentDb;
  readonly stage: StageRuntime;            // 파싱된 맵, 경로 폴리라인
  readonly state: Readonly<BattleState>;   // view/ui는 읽기만

  /** 명령을 큐에 넣는다. 실제 적용은 다음 flush()/step()에서. */
  enqueue(cmd: Command): void;
  /** 큐의 명령을 시간 진행 없이 적용한다 (일시정지 중 배치용). */
  flush(): SimEvent[];
  /** flush + 1틱 진행. 이번 틱에 생긴 이벤트를 돌려준다. */
  step(): SimEvent[];

  // UI가 쓰는 조회 헬퍼 (상태를 바꾸지 않음)
  checkDeploy(unitId: string, tile: Tile): DeployCheck;   // { ok: true } | { ok: false, reason }
  rangeTilesFor(unitId: string, tile: Tile, dir: Dir): Tile[];
  unitAt(tile: Tile): Readonly<UnitEntity> | undefined;
  rosterView(): RosterCardView[];          // 카드 표시용: 상태, 비용, 남은 대기 시간
}
```


고지대 디펜스 수정으로 모든 아군은 높은 칸에 배치하며 체력·반격·저지를 제거했습니다. 배치·후퇴·도토리·재배치·자동 공격과 스킬 8종·상태이상·특성을 구현했습니다. `flush`는 시간 진행 없이 명령과 스킬 즉시 효과를 적용합니다. T1.5·T1.6의 브라우저 루프·뷰·입력에 SP 표시와 스킬 버튼을 연결했습니다.

`DeployCheck`는 `{ ok: true } | { ok: false, reason: RejectReason }`입니다. `RosterCardView`는 `unitId`, `state`(`ready`/`noDp`/`deployed`/`cooldown`), `cost`, `cooldownSec`(실수 초), `uid`를 반환합니다. 카드 상태는 기존 로스터 상태에서 도토리 부족만 파생하며, 배치 제한은 `stage.definition.deployLimit`과 현재 유닛 수로 표시합니다. 조회 함수와 명령 처리에서 같은 배치 판정을 재사용합니다.

- 명령(Command)과 이벤트(SimEvent)의 정확한 형태는 [02-combat-rules.md](02-combat-rules.md) 17절에 있습니다.
- 거부된 명령은 상태를 바꾸지 않고 `{ type: 'commandRejected', cmd, reason }` 이벤트를 냅니다. UI는 이 이벤트로 토스트를 띄웁니다.
- `state`의 엔티티 배열은 항상 uid 오름차순입니다 (새 엔티티는 뒤에 추가되므로 자연히 정렬됨).

## 4. 게임 루프 (src/app/loop.ts)

sim은 고정 틱, 렌더는 `requestAnimationFrame`으로 돌고, 둘 사이는 보간합니다.

```ts
const TICK_SEC = 1 / TICK_RATE;           // 1/30
const MAX_STEPS_PER_FRAME = 8;

let acc = 0;
let last = performance.now();

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  const scale = paused ? 0 : speed * (bulletTime ? BULLET_TIME_SCALE : 1);  // speed: 1 | 2
  acc += dt * scale;

  let steps = 0;
  while (acc >= TICK_SEC && steps < MAX_STEPS_PER_FRAME) {
    const events = battle.step();
    view.onEvents(events);
    ui.onEvents(events);
    acc -= TICK_SEC;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) acc = 0;   // 탭 복귀 등으로 밀린 시간은 버림

  if (paused) {
    const events = battle.flush();               // 일시정지 중에도 배치는 바로 반영
    view.onEvents(events);
    ui.onEvents(events);
  }

  const alpha = acc / TICK_SEC;                  // 0..1, 이전 틱과 현재 틱 사이 보간 비율
  view.render(battle.state, alpha, dt * scale);  // 연출 시간도 sim과 같은 배율 (일시정지면 0)
  ui.update(battle.state, dt);                   // HUD 애니메이션은 실제 시간
  requestAnimationFrame(frame);
}
```

- **배속**(1×/2×), **일시정지**, **슬로모션**(배치·조준·유닛 선택 중 0.25배)은 모두 앱이 정합니다. sim은 모릅니다.
- 탭이 숨겨지면(`visibilitychange`) 자동으로 일시정지합니다.
- 보드 위 연출(캐릭터 애니메이션, 투사체, 파티클)은 sim과 같은 배율이 곱해진 시간으로 흐릅니다. 2배속이면 빨라지고, 슬로모션이면 느려지고, 일시정지면 멈춥니다. 투사체 도착과 피해 숫자 타이밍이 sim과 어긋나지 않게 하기 위해서입니다.
- HUD(DOM) 애니메이션과 토스트는 실제 시간으로 흐릅니다.

## 5. 이벤트 흐름 예시: 배치

1. 사용자가 카드를 드래그해 칸에 놓고 방향을 정함 → `controller`가 `battle.enqueue({ type: 'deploy', unitId, tile, dir })`
2. 다음 `step()` 1단계에서 sim이 검증 → 성공하면 도토리 차감, 유닛 생성, `unitDeploy` 이벤트
3. `boardView.onEvents`가 `unitDeploy`를 받아 스프라이트를 만들고 떨어지는 연출 재생
4. `deployBar`는 매 프레임 `battle.rosterView()`로 카드 상태 갱신
5. 실패하면 `commandRejected` → `toast`가 이유를 표시하고 카드가 흔들림

## 6. 화면 구성 (index.html)

```html
<div id="app">
  <canvas id="board"></canvas>      <!-- Three.js, z-index 0 -->
  <canvas id="overlay"></canvas>    <!-- 2D 오버레이, pointer-events: none, z-index 1 -->
  <div id="hud"></div>              <!-- DOM HUD, z-index 2 -->
  <div id="screens"></div>          <!-- 타이틀·결과·일시정지, z-index 3 -->
</div>
```

- 배경 하늘은 `#app`의 CSS 그라데이션입니다. Three.js 캔버스는 투명하게 둡니다.
- 입력은 `#board` 캔버스의 pointer 이벤트로 받습니다 (`touch-action: none`). HUD 요소는 각자 이벤트를 받습니다.

## 7. 로딩 순서 (src/main.ts)

T2.4에서는 동적 콘텐츠 로드·검증 후 `createApp(content, app)`으로 타이틀을 표시합니다. App은 화면 전환과 저장 기록을 소유하고, 시작·다시 하기마다 새 BattleSession을 만듭니다. 세션은 Battle·뷰·오버레이·입력·HUD를 소유하며, `dispose`로 루프·observer·리스너·텍스처·메시·WebGL 컨텍스트를 정리합니다. 컨텍스트를 해제한 캔버스는 다음 시작 때 새 캔버스로 교체합니다. 페이지 새로고침은 사용하지 않습니다.

전투 종료 이벤트가 오면 마지막 프레임을 그린 후 루프를 멈추고 결과를 표시합니다. 결과 화면 뒤 보드는 크기가 바뀔 때만 다시 그립니다. 결과·일시정지 메뉴는 native dialog로 표시하고, 메뉴가 열려 있는 동안 배치 입력과 전투 단축키를 막습니다. T3.1에서 앱 시작 시 SVG 22종을 캔버스로 선로딩해 App과 BattleSession에 전달하며 카드·타이틀·팝업에도 동물 초상화를 사용합니다.

1. `content = validateContent(raw)`. 실패하면 화면에 에러 메시지를 띄우고 중단합니다 (개발 중 데이터 실수를 바로 보이게).
2. 폰트 로딩 대기 (`document.fonts.ready`, 최대 2초).
3. 모든 artId의 SVG를 텍스처로 굽기 (`textures.ts`, Promise.all).
4. `App` 시작 → 타이틀 화면.

## 8. 성능 예산

- 동시 적 60, 유닛 12, 투사체·파티클 200 이하에서 데스크톱 60fps, 중급 모바일 30fps 이상.
- 드로우콜 120 이하. 타일은 종류별 InstancedMesh로 그립니다.
- 프레임마다 `new Vector3()` 같은 할당을 하지 않습니다. 모듈 스코프 임시 객체를 재사용합니다.
- sim 1틱은 1ms 이하 (적 60 기준). 경로 탐색은 전투 시작 때 한 번만 합니다.
