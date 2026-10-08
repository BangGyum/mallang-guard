# 06. 아트, 애니메이션, 효과음

외부 이미지·사운드 파일 없이 **코드로 생성**합니다. 나중에 일러스트나 Spine으로 바꿀 수 있도록, 그림은 `artId` 하나로만 참조합니다.

## 1. 팔레트 (src/art/palette.ts)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `outline` | `#3A2C3C` | 모든 캐릭터 외곽선 (순검정 금지) |
| `eye` | `#2A1E2C` | 눈 |
| `blush` | `#FF8FA8` (불투명도 0.75) | 볼터치 |
| `accent` | `#E5466B` | 목도리, 십자, 체리 |
| `butter` | `#FFC94A` / `#FFC22E` | 안전모, 별, 스킬 준비 |
| `leaf` | `#3FA66B` | 잎, 줄기 |
| `hudInk` | `#241C30` | HUD 바탕 |
| 지형 색 | 04 문서 3절 | |

## 2. 캐릭터 생성기 (src/art/critters.ts)

```ts
export function critterSvg(id: ArtId): string;   // 완전한 <svg xmlns=… viewBox="0 0 100 100" width="256" height="256">…</svg>
export const CRITTER_ANCHOR = { x: 50, y: 93 };   // 발 위치 (viewBox 단위). 스프라이트 원점에 맞춤
```

**이식할 원본**: [`../plan.html`](../plan.html) 하단 `<script>`의 `const C = { … }` 객체와 그 위의 부품 함수들(`S`, `BODY`, `eyes`, `blush`, `mouth`, `feet`, `body`, `belly`, `roundEars`, `spiral`, `star`)입니다. 그대로 TypeScript로 옮기고, 키 이름만 아래처럼 바꿉니다.

| plan.html 키 | ArtId | 비고 |
| --- | --- | --- |
| `tori` | `squirrel` | |
| `cat` | `cat` | |
| `bear` | `bear` | |
| `penguin` | `penguin` | |
| `sheep` | `sheep` | |
| `bunny` | `bunny` | |
| `mole` | `mole` | |
| `snail` | `snail` | |
| `jelly` | `jelly` | |
| `crow` | `crow` | |
| (새로) | `hardJelly` | 아래 참고 |
| (새로) | `pudding` | plan.html 장면 코드의 `G` 타일 푸딩 그림을 옮김 |

**새로 그릴 것**
- `hardJelly`: `jelly`와 같은 몸통 실루엣에 색은 `#6E8BE8`, 머리에 회색 양동이 투구(`#B8C2CE`, 리벳 점 3개)를 씌웁니다. 눈썹을 더 찡그려 단단한 인상을 줍니다.
- `pudding`: 접시 + 사다리꼴 커스터드(`#FFD77A`) + 캐러멜 윗면(`#9A5A2E`) + 체리. 눈과 볼터치가 있습니다.

**새 캐릭터를 만들 때 지킬 규칙**
- 몸통·눈·볼터치·발은 공용 부품을 씁니다. 그래야 그림체가 유지됩니다.
- 외곽선 굵기는 2.2~3.2, 색은 `outline`입니다.
- 소품은 몸 밖으로 나와 실루엣이 달라 보이게 둡니다 (60px 크기에서도 구분되게).
- 적은 찡그린 눈썹을 넣고 차가운 색(보라·파랑·회색)을 씁니다. 아군은 따뜻한 색을 씁니다.

**이펙트용 작은 그림** (src/art/vfxArt.ts, `vfxSvg(id)`, viewBox 0 0 64 64)

`snowball`, `star`, `stickyDrop`, `heartPlus`, `spark`(별 모양 터짐), `droplet`(젤리 방울), `goo`(바닥 웅덩이), `stunStar`, `acorn`(도토리 아이콘, HUD와 카드에도 사용)

## 3. 크기와 배치 기준

- 스프라이트 키(월드 단위)는 04 문서 4절 표를 따릅니다.

## 4. 애니메이션 (view/entityViews.ts)

뼈대 없이 스프라이트의 위치·스케일·uniform만으로 표현합니다. 시간은 `view.render`가 받는 배율 적용 dt입니다 (01 문서 4절). 2배속이면 빨라지고 일시정지면 멈춥니다.

| 상태 | 대상 | 파라미터 |
| --- | --- | --- |
| idle (숨쉬기) | 유닛 | 주기 1.35초, scaleY 1 → 0.93, scaleX 1 → 1.05 (사인). 엔티티별 위상을 다르게 |
| hop (이동) | 지상 적 | 주기 = 0.5초 ÷ (속도/0.9). 높이 0.12 × \|sin\|, 착지 순간 scale (1.1, 0.88) |
| flap (비행) | 비행 적 | 위아래 0.06, 주기 0.8초 |
| attack (원거리) | 유닛 | 뒤로 0.05 반동 + scale (0.92, 1.08) 0.1초 |
| hit | 적 | `uFlash` 1 → 0, 0.08초. 피격 방향 반대로 0.04 밀림 |
| skill active | 유닛 | idle 진폭 1.5배, 발밑 링 맥동 |
| deploy | 유닛 | 높이 +1.2 → 0, 0.25초 ease-out-bounce. 착지 때 scale (1.2, 0.8) → 1 |
| death | 적 | 0.25초 동안 scale (1.3, 0)으로 납작해짐 |
| leak | 적 | 골 칸에서 푸딩 쪽으로 빨려 들어가듯 작아짐 0.2초 |

- 여러 상태는 겹칠 수 있습니다 (예: idle + hit). 최종 스케일 = 각 상태 스케일의 곱으로 계산합니다.
- 연속 원거리 공격의 피격 지연은 각각 보관합니다. 뒤의 공격이 아직 도착하지 않은 앞선 피격 효과를 취소하지 않습니다.
- `prefers-reduced-motion`이면 idle 진폭을 0으로, hop 높이를 절반으로 줄입니다.

## 5. 효과음 (src/audio/sfx.ts, M3)

WebAudio 오실레이터와 노이즈로 합성합니다. 파일은 없습니다. AudioContext는 첫 실제 사용자 입력(pointerdown/keydown) 때 만듭니다. 앱당 컨텍스트 하나를 재사용하고 앱 종료 때 닫습니다. 일시정지 메뉴에서는 재생 중인 소리를 끄고 도착 전 효과음은 보관합니다. 재시작/타이틀 복귀 때는 보관한 효과음까지 정리합니다.

| 이름 | 언제 | 소리 느낌 |
| --- | --- | --- |
| `deploy` | unitDeploy | 짧은 상승음 "뿅" (사인 400→900Hz, 0.12초) |
| `hit` | 물리 피해 | 짧은 노이즈 "퍽" (저역 통과, 0.06초) |
| `shoot` | 원거리 공격 | 작은 "슝" (삼각파 하강) |
| `magic` | 마법 피해, skillPulse | 반짝 화음 (사인 2음) |
| `pop` | enemyDie | 물방울 "퐁" (사인 빠른 하강) |
| `skill` | skillStart | "짠" (사각파 3음 아르페지오) |
| `leak` | enemyLeak | 낮은 경고음 2회 |
| `win` / `lose` | battleEnd | 짧은 징글 |

- 같은 소리는 50ms 안에 최대 3번만 재생합니다 (겹침 폭주 방지).
- 전체 볼륨은 설정값(`sfxVolume`)을 따릅니다.
- 원거리 피해·사망 효과음과 종료 징글은 매 프레임 화면 연출과 같은 dt로 대기합니다. 도중에 일시정지·배속·선택 중 느린 시간이 바뀌어도 함께 진행하며, 도착 시점에 WebAudio 소스를 만듭니다. 음소거 상태에서는 새로운 소리를 만들지 않습니다.
