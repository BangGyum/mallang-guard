# 04. 렌더링 (src/view)

목표 화면은 [`../plan.html`](../plan.html) 맨 위의 전투 목업과 [`../concepts/battle-screen-v2-fresh.png`](../concepts/battle-screen-v2-fresh.png)의 산뜻한 동물·파스텔 정원 방향입니다. 기울어진 카메라로 본 타일 디오라마 위에 2D 동물들이 서 있는 모습입니다.
view는 sim 상태를 **읽기만** 하고, `onEvents(events)`로 받은 이벤트로 연출을 재생합니다.

## 1. 좌표 변환 (view/coords.ts)

- 맵 크기가 W×H일 때 타일 좌표 `(x, y)` → 월드 좌표 `(x − W/2, height, y − H/2)`.
  - 월드 X = 타일 x 방향, 월드 Z = 타일 y 방향(카메라 쪽 +), 월드 Y = 높이입니다.
- sim의 실수 위치 `(px, py)`도 같은 식으로 바꿉니다. 타일 중심은 `(x + 0.5 − W/2, h, y + 0.5 − H/2)`입니다.

**타일 윗면 높이**

| kind | 윗면 높이 | 비고 |
| --- | --- | --- |
| ground, path, spawn, goal | 0 | |
| high | 0.5 | 고지대 블록 |
| blocked | 0.15 | 덤불 화단 |

- 각 타일 박스는 윗면에서 아래로 −0.25까지 내려옵니다.
- 보드 전체 아래에 흙 받침(−0.25 ~ −0.9)을 깔아 디오라마처럼 보이게 합니다.

## 2. 렌더러와 카메라

- `WebGLRenderer({ canvas, antialias: true, alpha: true })`
- `setPixelRatio(min(devicePixelRatio, 2))`. 품질 low면 1입니다.
- `outputColorSpace = SRGBColorSpace`, 톤매핑 없음(파스텔 색 보존).
- 그림자: `PCFShadowMap`, 품질 low면 끕니다. Three.js r186에서 deprecated인 `PCFSoftShadowMap` 대신 현재 PCF를 사용합니다.
- 배경은 투명하고, 하늘 그라데이션은 CSS(`#BFE6EE → #E9F6EA`)로 칠합니다.

**카메라** (view/camera.ts)
- `PerspectiveCamera`, fov 30°, yaw 0(보드 정면), 아래로 55° 숙여 봅니다.
- `fitCamera(boardBox, aspect, safeRect)`: **순수 함수로 분리**해서 테스트합니다.
  - `boardBox`는 보드 AABB입니다: x ∈ [−W/2, W/2], z ∈ [−H/2, H/2], y ∈ [−0.9, 1.2] (캐릭터 키 포함).
  - `safeRect`는 NDC 기준 x ∈ [−0.94, 0.94], y ∈ [−0.62, 0.86]입니다. 하단 19%는 배치 바, 상단 7%는 HUD 자리입니다.
  - T1.6의 높이 500px 이하 화면은 44px 터치 버튼과 카드 공간을 위해 y ∈ [−0.45, 0.68]을 사용합니다. 피킹은 리사이즈된 같은 카메라를 사용합니다.
  - 거리 d를 [4, 80]에서 이분 탐색(24회)해 AABB 꼭짓점 8개가 모두 safeRect 안에 드는 최소 d를 찾습니다.
  - 각 거리 후보에서 투영된 bbox의 중심이 safeRect 중심에 오도록 right/up 방향으로 2회 평행 이동합니다. 이동 후의 투영으로 꼭짓점을 검사해 최종 피팅에서 잘림을 방지합니다.
- 창 크기가 바뀌면 다시 맞춥니다. 전투 중 카메라 조작(줌·팬)은 v0.1에 없습니다.

**조명** (값은 시작점이고, 목업과 비슷한 밝기로 조정합니다)
- `HemisphereLight(0xffffff, 0xb9a7d9, 1.0)`
- `DirectionalLight(0xfff4e0, 2.0)`를 보드 중심 기준 (−4, 8, 5) 방향에 둡니다. `castShadow`, shadow map 2048, 그림자 카메라 범위는 보드에 딱 맞게.

## 3. 타일 (view/tiles.ts)

- 지오메트리: `RoundedBoxGeometry(0.96, 두께, 0.96, 2, 0.06)` (`three/addons/geometries/RoundedBoxGeometry.js`). 윗면이 높이 표에 맞게 놓이도록 위치를 잡습니다.
- 타일 종류마다 `InstancedMesh` 하나씩 씁니다.
- 재질: `MeshToonMaterial` + 3단 그라데이션 맵 (`DataTexture` [90, 170, 255], `NearestFilter`). `castShadow`, `receiveShadow` 모두 켭니다.

| kind | 색 |
| --- | --- |
| ground / path | `#F3DCA6` (모래) |
| high | `#E7E1F7` (연보라 돌) |
| blocked | `#93D47E` (잔디) |
| spawn | `#FFA7B4` |
| goal | `#A9D3FF` |
| 받침 | `#A87F5D` (흙) |

**장식**
- `blocked` 타일마다 덤불 1~2개: `IcosahedronGeometry(1, 1)`을 납작하게 스케일, 색 `#5FB45A`, InstancedMesh.
- 위치는 `tileSeed = x * 73856093 ^ y * 19349663`로 만든 view 전용 난수로 정합니다 (매번 같은 배치).
- 30% 확률로 분홍 꽃(작은 구, `#FF8FB1`)을 답니다.
- 고지대 윗면 앞 가장자리에 흰 하이라이트 선(얇은 박스, 불투명도 0.6)을 그어 블록감을 살립니다.

**스폰·골 표시**
- 스폰: 빨간 링(`RingGeometry`, additive, 맥동 애니메이션)과 소용돌이 점선.
- 골: 푸딩 스프라이트(art `pudding`)를 빌보드로 세웁니다. 누수 때 흔들리는 연출을 넣습니다.

## 4. 캐릭터 스프라이트 (view/sprites.ts)

T3.1부터 목업의 SVG 동물·적을 사용하며 방향에 따라 좌우 반전합니다. 앱이 아트 생성기를 호출해 구운 캔버스를 뷰에 전달하므로 뷰는 아트 모듈을 직접 참조하지 않습니다. 카드·타이틀·유닛 팝업도 같은 SVG를 사용합니다.

- 지오메트리: `PlaneGeometry(1, 1)`를 `translate(0, 0.43, 0)`해서 SVG의 발 앵커 `(50,93)`를 원점에 둡니다.
- 크기(월드 단위 키): 유닛 0.9, jelly 0.75, hardJelly 0.85, crow 0.7, splitJelly 0.85, miniJelly 0.65, spitter 0.8, kingJelly 1.2, pudding 0.8.
- 비행 적은 지면 위 1.2 높이에 그립니다.
- **빌보드**: 카메라가 고정이므로 모든 스프라이트에 `quaternion.copy(camera.quaternion)`를 한 번 적용합니다 (카메라를 다시 맞출 때도 갱신).
- 좌우 방향: 유닛 `dir`이 left면 `scale.x = −1`, 그 외는 +1. 적은 이동 방향의 x 부호를 따릅니다 (0이면 직전 값 유지).
- 배치 이벤트에서 낙하 시작 자세·숨쉬기 스케일·빌보드 방향을 먼저 적용합니다. 첫 렌더 전 공격도 같은 무기 끝 좌표에서 발사합니다.
- **스프라이트 셰이더** (`ShaderMaterial`, 텍스처마다 하나씩, 공유 가능)
  ```glsl
  uniform sampler2D map; uniform float uFlash; uniform vec3 uTint; uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;                 // 알파 테스트라 정렬 문제 없음
    c.rgb = mix(c.rgb * uTint, vec3(1.0), uFlash);
    gl_FragColor = vec4(c.rgb, uOpacity);
    #include <colorspace_fragment>
  }
  ```
  - 실제 캐릭터는 `spriteBatch.ts`에서 그림별 InstancedMesh로 묶고, 인스턴스별 flash/tint/opacity 속성을 전달합니다. 배치 고스트는 별도 uniform 재질을 씁니다.
  - `depthWrite: true`, `transparent: true`와 알파 테스트를 사용합니다. 사망 연출은 인스턴스 opacity로 사라집니다.
- **그림자**: 발밑에 납작한 원(검정, 불투명도 0.22, `depthWrite: false`)을 높이 +0.01에 둡니다. 비행 적은 지면에 더 옅게(0.14) 그립니다. 스프라이트는 그림자 맵에 넣지 않습니다.

## 5. 텍스처 굽기 (view/textures.ts)

- `critterSvg(artId)`(06 문서)로 SVG 문자열을 받습니다.
- `Blob` → `URL.createObjectURL` → `Image` 로드 → 256×256 캔버스에 그리기 → `CanvasTexture`.
- 텍스처 설정: `colorSpace = SRGBColorSpace`, `anisotropy = 4`, 밉맵 사용.
- 앱 시작 때 artId별로 전부 미리 굽습니다 (`Promise.all`). 원본 캔버스는 앱에서 재사용하고 GPU 텍스처는 세션마다 만들어 종료 시 해제합니다. Blob URL은 성공·실패 모두 해제합니다.
- 이펙트용 작은 그림(`vfxSvg`)도 같은 방식으로 128×128에 굽습니다.
- 카드 초상화처럼 UI에 쓰는 그림은 텍스처가 아니라 SVG 문자열을 DOM에 그대로 넣습니다.

## 6. 엔티티 뷰와 보간 (view/entityViews.ts)

- `Map<uid, EntityView>`를 둡니다. 이벤트로 만들고(`unitDeploy`, `enemySpawn`) 지웁니다(`unitRetreat`, `enemyDie`, `enemyLeak`. 사망은 연출이 끝난 뒤 제거).
- 매 프레임 적 위치는 `lerp(px, x, alpha)`, `lerp(py, y, alpha)`로 보간합니다. 유닛은 칸에 고정입니다.
- 매 프레임 sim 상태와 대조합니다. 이벤트를 놓쳐서 sim에는 없는데 뷰에만 남은 엔티티는 지웁니다 (방어 코드).
- 애니메이션 상태와 파라미터는 06 문서 4절을 따릅니다.
- M4 분열 자식은 `enemySpawn.parentUid`로 부모의 원거리 처치 지연을 받아 그림과 HP/상태 표시를 함께 늦춥니다. 기존 적의 45ms 히트스톱과 상태 보간은 유지합니다.

## 7. 연출 (view/vfx.ts)

이벤트 → 연출 매핑입니다. 파티클과 투사체는 풀링한 메시(최대 200개)로 그립니다.

| 이벤트 | 연출 |
| --- | --- |
| `unitDeploy` | 위(+1.2)에서 떨어지며 통 튕김 0.25초, 먼지 고리 |
| `unitDisrupt` | 적 → 친구에게 끈적 방울 투사체 0.25초. SP 아래 방해 문구와 팝업의 남은 시간 |
| `attack` (ranged) | 빌보드 좌우 반전·자세를 반영한 무기 끝 → 대상으로 0.25초. 소총 탄환·냉각탄·아크 탄·검기·충격파는 직선, 점착탄은 작은 포물선. 이동 방향으로 그림을 회전하고 총구 화염·도착 스파크를 표시 |
| `damage` | 피격 플래시. 원거리는 투사체가 닿는 시점(0.25초 뒤)에 맞춰 재생 |
| `skillStart` | 유닛 주변 원형 파동, 유닛 스쿼시. 지속 스킬은 끝날 때까지 발밑에 맥동 링 |
| `skillPulse` | 사거리 칸 위로 아크 포격이 쏟아짐 |
| `status` slow on | 적 발밑에 보라 끈적 웅덩이 (off까지 유지) |
| `status` stun on | 머리 위에 별 3개가 빙글빙글 |
| `enemyDie` | 젤리 방울 8개가 튀고 본체는 납작해지며 사라짐 0.25초 |
| `enemyLeak` | 푸딩 흔들림, 화면 가장자리 빨간 비네트 0.3초, 카메라 흔들림 0.2초 (강도 0.05) |

- `prefers-reduced-motion`이면 카메라 흔들림을 끄고 파티클 수를 절반으로 줄입니다.
- 원거리 피해 숫자도 투사체 도착 시점에 띄웁니다. sim은 즉시 피해를 주지만, 화면은 0.25초 늦게 보여 주는 것입니다.
- 같은 이벤트 묶음에서 공격자별 투사체 지연을 추적합니다. 앞서 발생한 스킬 펄스나 다른 근접 공격에는 지연을 적용하지 않습니다. 마지막 적도 투사체/사망 효과를 마치도록 결과 화면은 0.65초 뒤 열립니다.
- 파티클은 그림별 InstancedMesh와 공유 200개 슬롯, 피해 숫자는 64개 슬롯을 재사용합니다. 발밑 그림자도 지상/비행별로 묶습니다. 고정 지형의 그림자 맵은 초기화·리사이즈 때만 갱신합니다.

## 8. 강조 표시 (view/highlights.ts)

- 타일 윗면 +0.02 높이에 둥근 사각 평면(0.92)을 깝니다. InstancedMesh, `MeshBasicMaterial` 투명.

| 종류 | 색 / 불투명도 | 언제 |
| --- | --- | --- |
| 배치 가능 칸 | `#7BE08E` / 0.35 | 카드를 드래그하는 동안, 그 유닛이 놓일 수 있는 빈 칸 |
| 사거리 | `#FFC22E` / 0.40 | 조준 중(방향 미리보기), 유닛 선택 중 |
| 마우스가 올라간 칸 | `#FFFFFF` / 0.45 | 드래그 중 마우스 아래 칸 |

## 9. 2D 오버레이 (view/overlay.ts)

WebGL 위에 2D 캔버스(`#overlay`)를 겹쳐서 글자와 바를 선명하게 그립니다. 크기는 CSS 픽셀 × DPR입니다.

매 프레임 지우고 다시 그립니다.
- **HP 바**: 적 발 위치를 화면에 투영한 점 아래 6px. 폭 40px(적은 크기에 비례), 높이 5px, 둥근 모서리. 적 `#FF5A6E`, 배경 `rgba(36,28,48,.75)`. 적은 피해를 입기 전에는 숨깁니다.
- 유닛에는 SP 게이지와 방향 화살표, SP/준비!/스킬 중 문구를 표시합니다. 아군 HP 바는 없습니다.
- **SP 바** (유닛): 발 위치를 투영한 점 아래 6px. 충전 중 `#759BDB`, 준비됨 `#F1C743`, 발동 중에는 남은 시간 비율을 `#EEA54B`로.
- **스킬 준비 말풍선**: 수동 스킬이 ready면 머리 위에 "스킬!" 말풍선 (노란 바탕, Jua 15px). 위아래로 살짝 흔들립니다.
- **스킬 발동 알림**: `skillStart`의 유닛 위치를 화면 좌표로 투영해 DOM HUD에 유닛 이름·스킬 이름을 띄웁니다. 수동·자동 스킬 모두 표시하며 실제 시간 1.9초 뒤 사라집니다. 위치·접근성·입력 규칙은 [05 문서](05-ui-input.md)의 스킬 발동 알림을 따릅니다.
- **피해 숫자**: 맞은 위치에서 0.6초 동안 위로 떠오르며 사라집니다. 물리 흰색(외곽선 진자주), 마법 `#C9A6FF`, 정수로 반올림.
- 글꼴은 Jua, 없으면 sans-serif입니다.

투영은 `vector.project(camera)` → `(ndc.x + 1) / 2 * width`, `(1 − ndc.y) / 2 * height`입니다.

## 10. 피킹 (view/picking.ts)

화면 좌표 → 타일 변환입니다. 광선과 수평면의 교차를 직접 계산합니다 (메시 레이캐스트를 쓰지 않음).

1. 포인터의 NDC로 카메라 광선을 만듭니다.
2. 평면 y = 0.5와 교차시킨 타일이 맵 안이고 kind가 `high`면 그 타일을 돌려줍니다.
3. 아니면 평면 y = 0과 교차시킨 타일이 맵 안이면 그 타일을 돌려줍니다.
4. 둘 다 아니면 `null`입니다.

- 수학 부분(`rayPlaneTile(origin, dir, planeY, W, H)`)은 순수 함수로 분리해 테스트합니다.
- 유닛 선택도 타일로 합니다. 고른 타일에 유닛이 있으면 그 유닛입니다.

## 11. 품질과 리사이즈

- 품질 `high`: DPR ≤ 2, 그림자 켬. `low`: DPR 1, 그림자 끔, 파티클 절반.
- 기본은 `high`입니다. 첫 전투 진행 3초 평균 fps가 40 미만이면 자동으로 `low`로 바꾸고 저장합니다. 정지 시간은 제외하며, 설정에서 수동 품질을 선택하면 현재 앱 실행 동안 자동 전환하지 않습니다. 설정 변경은 렌더러·오버레이 DPR·그림자·파티클에 즉시 적용합니다.
- `ResizeObserver`로 `#app` 크기를 감시하고, 렌더러·오버레이 크기와 카메라 피팅을 갱신합니다.
- `BoardView.memory`는 검증용 읽기 전용 지오메트리·텍스처 개수(`renderer.info.memory` 복사본)를 제공합니다. `dispose`는 모든 메시·텍스처·그림자와 렌더러·컨텍스트를 해제합니다. 재시작할 때는 새 캔버스를 사용합니다.
