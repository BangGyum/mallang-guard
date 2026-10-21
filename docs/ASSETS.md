# 생성 에셋 기록

## 나머지 11종 2D 동물 특무대 (2026-10-16, T4.37)

내장 image_gen, `transparent_background: true`. `wolfAimV2.png`와 `luaAim.png`를 그림체·큰 머리/짧은 몸 비율 참고로 제공했습니다. 기존 SVG 생성기는 모두 보존합니다. 카드·정보·상점·알림·드래그·보드에 새 이미지를 연결하며 전투 규칙과 사운드는 유지합니다.

| 캐릭터 | 파일 |
| --- | --- |
| 토리 (squirrel) | `src/art/assets/toriAim.png` |
| 굴굴 (mole) | `src/art/assets/moleAim.png` |
| 냥기사 (cat) | `src/art/assets/catReady.png` |
| 뚜껑곰 (bear) | `src/art/assets/bearReady.png` |
| 펭펭 (penguin) | `src/art/assets/penguinAim.png` |
| 토실 (bunny) | `src/art/assets/bunnyAim.png` |
| 몽실 (sheep) | `src/art/assets/sheepCast.png` |
| 끈끈 (snail) | `src/art/assets/snailAim.png` |
| 밤밤 (owl) | `src/art/assets/owlCast.png` |
| 세라 (deer) | `src/art/assets/deerCast.png` |
| 노바 (snowLeopard) | `src/art/assets/novaAim.png` |

### 공통 생성 프롬프트

각 생성의 실제 프롬프트는 다음 공통 문장 뒤에 캐릭터별 문장을 붙인 내용입니다.

Use case: stylized-concept. Create ONE production transparent 2D game sprite for an original animal special-forces defense game. Reference images are ONLY guides for crisp dark outlines, flat cel shading, big expressive HEAD and short compact BODY proportions. Keep each requested species anatomically recognizable, NOT a human with animal ears, NOT a wolf reskin. About 2 heads tall excluding ears/weapon, short sturdy legs, face dominant and unobscured. Cute but capable battle-ready expression. Three-quarter stance facing RIGHT, weapon/action point on RIGHT, body centered and feet/support along bottom. Full uncropped character including all ears, paws, tail and entire weapon, 3% transparent margin on EVERY edge. Fresh light colors, cream tactical accents, dark slate mechanisms, 2-3 flat shades per material. Clean readable silhouette at 48-64px. Single isolated character, no text, no logo, no panels, no extra poses, no scenery, no floor shadow, no projectile, no muzzle flash, no smoke. Genuine transparent alpha. No 3D rendering, no photorealism, no glossy plastic, no excessive small details.

### 토리 생성 프롬프트

Warm orange-brown SQUIRREL scout with cream muzzle/belly, small rounded tufted ears, prominent huge fluffy curved squirrel tail on LEFT, amber focused eyes, tiny black nose. Compact sand tactical vest and mint neck kerchief, dark communication headset with short microphone, a small acorn-shaped brass clasp. Two paws hold ONE clearly recognizable compact semi-automatic PISTOL pointing horizontally RIGHT at chest level. Small handgun, no long rifle, no laser weapon. Legs short, broad planted furry feet. Friendly resourceful point scout.

### 굴굴 생성 프롬프트

Burly small charcoal/taupe MOLE close-range specialist with very short velvety fur, barely visible small ears, pink protruding round nose, small sharp focused eyes, wide digging paws with short cream claws, stubby legs. Olive gray combat HELMET with small amber headlamp, sand utility vest, dark pouches. Both paws grip ONE compact heavy PISTOL pointing horizontally RIGHT at chest height, barrel completely visible. Wide sturdy compact stance. No long rifle, no giant wolf ears, no long fluffy tail. Visually distinct squat subterranean scout.

### 냥기사 생성 프롬프트

Silver-gray tabby CAT knight with cream muzzle, triangular cat ears, distinct forehead and cheek tabby stripes, green focused eyes, long curved slender cat tail LEFT, small feline nose. Light cream and muted blue-gray plated shoulder/chest armor with mint cloth tabard. Holds ONE straight broad silver combat SWORD with simple brass crossguard in a ready stance: sword projects diagonally upward RIGHT, complete blade tip clear on right silhouette at approximately forehead height. A paw grips hilt at right waist, other paw braced near body. No gun, no heavy full-face helmet. Big feline face, short planted legs.

### 뚜껑곰 생성 프롬프트

Stocky BROWN BEAR heavy defender with large round ears, broad tan muzzle, big dark nose, determined amber eyes, oversized bear head and very compact muscular fluffy body. Cream and slate heavy tactical chest armor and shoulder guards. Wields ONE chunky short-handled IMPACT HAMMER on RIGHT, broad squared steel hammer head at chest/head height, and a ROUND reinforced pot-lid-like SHIELD on left forearm toward LEFT. Shield has simple brass central boss, no symbols or writing. Wide bear paws planted, stocky short legs. Both hammer and shield fully visible, neither obscures face. No gun.

초기 생성에서 해머가 왼쪽으로 배치되어 내장 image_gen으로 해당 그림을 편집했습니다. 아래 보정 프롬프트와 `transparent_background: true`를 사용한 결과가 최종 파일입니다.

Edit this brown bear defender sprite, preserving EXACTLY its character identity, big head short body proportions, cream/slate armor, crisp 2D linework, flat colors and three-quarter RIGHT-facing face/body stance. Correct ONLY the placement of the two weapons: put the large short-handled HAMMER in the hand on the VIEWER'S RIGHT, hammer head raised at right shoulder/eye level and fully outside the right side of the face silhouette; put the round SHIELD on the VIEWER'S LEFT forearm, below and left of the face. The impact attack will emit from the hammer on the RIGHT of the image. Do NOT mirror the entire image: the bear must keep looking RIGHT. No second hammer or second shield. Natural grip, complete hands and both planted feet, full hammer and shield visible, preserve dark scarf and gold details. Full uncropped single character, 3 percent margin around entire silhouette. Genuine transparent alpha background, no text, no extra poses, no effects, no ground shadow.

### 펭펭 생성 프롬프트

Navy-blue and white PENGUIN precision rifle soldier. Recognizable round penguin head, white face and belly, short orange beak, focused blue eyes, no furry mammal ears, small flippers gripping weapon, short orange webbed feet planted. Pale blue scarf, cream tactical harness and slate lightweight shoulder panels. Carries a slender dark navy/ivory SCOPED COOLING SNIPER RIFLE pointing horizontally RIGHT at chest level, small icy cyan cooling chamber near receiver. Long slim barrel and scope clearly visible, no huge railgun or grenade drum. Big head and compact squat penguin silhouette.

### 토실 생성 프롬프트

White RABBIT tactical support specialist, long upright rabbit ears with pink insides (slightly angled so not excessive height), large expressive pale rose eyes, small pink rabbit nose, cheek tufts and short round cotton tail. Compact cream and dusty teal tactical jacket, visible communication headset with short antenna on small backpack. Both paws hold a compact ivory/slate ENERGY SUPPORT CARBINE horizontally RIGHT at chest level, short barrel with pale mint energy lens. Clearly a firearm/carbine, not a medical syringe, no red cross. Short sturdy rabbit hind feet planted, face large and visible. Gentle confident expression but combat-ready.

### 몽실 생성 프롬프트

Cream woolly SHEEP arc mage, massive soft curly fleece framing large round face, drooping horizontal sheep ears, small curved tan horns close to head, beige muzzle and calm focused lavender eyes. Short cream/lavender tactical mage coat with mint trim, tiny split hooves below compact body. Holds one short ARC STAFF in RIGHT hand, staff leaning slightly right with a large simple CIRCULAR metal fork and cyan energy crystal at its top on RIGHT at eye height. Left hoof-hand open close to chest. Tool visibly arc-powered, not fire. Big wool head, very short legs, no long human body. No gun, no floating effects.

### 끈끈 생성 프롬프트

Unmistakable golden-cream SNAIL adhesive support specialist, large friendly focused snail head and two upright eye stalks, small mouth, broad low soft gastropod FOOT at base (NO mammal legs, NO human feet). Huge rose-pink spiral shell on LEFT/back, with a compact mint adhesive tank mounted to shell via cream harness and a visible hose. Two small stylized soft forearms grip a squat STICKY GEL LAUNCHER pointing horizontally RIGHT at chest level: rounded cream/slate canister body, mint gel window and short wide nozzle, distinct from rifle. Animal snail anatomy and spiral shell dominate; compact near-two-head silhouette, practical tactical straps. No antenna headset obscuring eye stalks.

### 끈끈 눈 보정 프롬프트

끈끈은 초기 생성의 중복 눈을 아래 프롬프트로 편집해 눈자루 끝의 두 눈만 남겼습니다. 내장 image_gen, 투명 배경을 유지했습니다.

Correct ONLY the duplicate eyes in this snail soldier sprite. It currently accidentally has FOUR eyes. Final character must have EXACTLY TWO eyes, BOTH at the tips of the two upright eye stalks. KEEP the two big expressive eyes on the stalk tips unchanged. REMOVE BOTH lower face eyes and their eyebrows entirely, replacing that area with uninterrupted plain warm yellow/cream snail skin matching nearby flat shading. Keep the small smiling mouth below. Do not add any new eyes, facial patches or accessories. Preserve exactly the pink spiral shell, mint tank and hose, gel launcher pointing RIGHT, two small arms, broad snail foot without legs, full silhouette, colors, pose, dark outlines and flat 2D cel shading. Single original snail, no text, no floor/shadow. Genuine transparent alpha background, same framing.

### 밤밤 생성 프롬프트

Graceful FEMALE CREAM OWL fire mage: large round owl facial disk, feather ear tufts, tiny golden hooked beak, soft but focused lavender eyes with subtle eyelashes, cream and warm tan feathers, compact feathery body and small planted talons. Airy flowing MINT CAPE with cream frill edge and a lavender ribbon, no heavy tactical helmet or bulky gun vest. Right wing-hand holds a carved wooden FIRE STAFF slightly leaning RIGHT; at top-right at forehead height is a small sculpted golden-orange flame-shaped crystal (no loose flame particles). Left wing holds an OPEN SPELLBOOK with blank cream pages, lavender cover, no readable lettering. Large expressive owl face, very short body, whole staff and wings visible. No firearms.

### 세라 생성 프롬프트

Graceful FEMALE DEER lightning mage with warm cream/tan fur, white muzzle, large sideways leaflike deer ears, small elegant branching antlers, subtle white cheek spots, focused lavender eyes with feminine eyelids, small black nose. Large deer head and tiny short body with split hoof feet, lavender tactical mage COAT with cream collar and small gold clasp; light split cape. RIGHT hoof-hand holds a LIGHTNING STAFF leaning right, branching antler-shaped pale violet metallic crown containing one white-blue crystal at right forehead level. Other hand holds a closed cream spell focus near waist. Clear deer face and antlers, no human girl anatomy. No gun, no flame.

### 세라 꼬리 보정 프롬프트

세라는 초기 생성의 긴 여우형 꼬리를 작은 사슴 꼬리로 보정했습니다. 내장 image_gen, 투명 배경을 유지했습니다.

Edit ONLY the tail of this deer mage sprite so she reads as a DEER rather than a fox. Replace the large fluffy fox-like tail at lower LEFT behind her waist (below the lavender cape) with ONE small short deer tail: a modest cream-white pointed tuft just behind the hip, much smaller than her head, no long curve, no large plume. Preserve EXACTLY everything else: branching antlers, large sideways deer ears, tan/cream fur and cheek spots, feminine violet eyes, big head/short body, lavender coat and cape, book, lightning staff and its crystal at upper RIGHT, dark split hooves, stance facing RIGHT, linework and flat colors. Do not shrink or remove the lavender cape panels; only the furry tail changes. Full single character on genuinely transparent alpha background, no text, no shadow, no other changes.

### 노바 생성 프롬프트

Powerful noble SNOW LEOPARD gravity artillery operator, silver-white fur with clearly visible slate-gray rosette SPOTS, ROUND feline ears (not fox pointed ears), broad feline muzzle, icy teal eyes, large head, thick long spotted tail curving LEFT. Dark NAVY short officer tactical coat with cream armor and restrained GOLD shoulder/collar accents, mint small neck scarf. Both paws carry a chunky futuristic GRAVITY CANNON aimed horizontally RIGHT at chest level, dark navy and ivory casing, large prominent circular golden-ring muzzle with turquoise concentric core. Compact heavy cannon, no ordinary rifle or long rail barrel. Short sturdy spotted legs and big paws planted, face clear above cannon. UR elite presence through clean strong silhouette, not elaborate ornamentation.


## 루아 2D 은여우 특무대 (2026-10-16, T4.36)

- 파일: `src/art/assets/luaAim.png` (1509×1042, 투명 PNG).
- 내장 image_gen, `transparent_background: true`. 랑랑 `wolfAimV2.png`와 로크 `rokeAim.png`를 선화·채색·큰 머리/짧은 몸 비율 참고로 제공했습니다.
- 은빛 여우·민트 코트·청록색 레일 라이플의 오른쪽 조준 자세. 카드·상점·정보·알림·드래그·전장에 사용하며 기존 `rareCritters.ts`의 fox SVG는 보존합니다.

### 생성 프롬프트

Create ONE production 2D game sprite for LUA, an original FEMALE SILVER FOX railgun specialist in an animal special-forces squad. References 1 (wolf) and 2 (red panda) are ONLY style and BIG HEAD / SHORT BODY proportion guides. Match their crisp dark outlines and flat cel shaded 2D animation art, not their species or weapons. Lua is unmistakably an anthropomorphic animal silver fox, NOT a human girl with ears: silver-white fur, pale cool gray ear tips and cheek tufts, large triangular fox ears, short pointed fox muzzle and tiny black nose, expressive focused teal eyes, subtly feminine eyelids, silver swept forehead tuft, furry paw hands and feet, very fluffy sweeping silver tail. Head dominant, about two heads tall excluding ears, very short compact torso and sturdy short legs. Cool capable, graceful but combat ready. Preserve identity: airy short mint tactical coat with split trailing panels, cream inner vest, dark slate gloves/boots, restrained brass clasps. Both paws hold a long unmistakable futuristic RAIL RIFLE at shoulder/chest height: dark graphite frame, ivory panels, two parallel open electromagnetic rails along barrel, cyan/teal energy core and small scope. Long straight horizontal barrel aiming RIGHT, distinct from a normal sniper rifle and from a grenade launcher. Full uncropped body, both planted paws, tail to left, entire muzzle to right. Three-quarter right-facing aiming stance, face visible above rifle. Large readable silhouette for 48-64px battlefield. Landscape framing approximately 1.45:1, minimal even padding. Genuine transparent alpha background. ONE character, no scene, no text, no labels, no border, no floor/shadow, no muzzle flash, no glow outside weapon, no smoke, no extra poses. Fresh mint/cream/silver palette, only 2-3 flat shades per material; no 3D, no photorealism, no glossy plastic, no tiny overdecorated details.

## 로크 2D 동물 특무대 (2026-10-16, T4.33)

- 파일: `src/art/assets/rokeAim.png` (1509×1042, 투명 PNG).
- 내장 image_gen 도구, `transparent_background: true`. `wolfAimV2.png`를 선화·채색·큰 머리 비율 참고로 사용했습니다. 첫 생성은 연결 오류로 실패했고 같은 조건의 재시도로 생성했습니다. CLI/API fallback은 사용하지 않았습니다.
- 카드·정보·상점·알림·드래그·전장에 사용합니다. 기존 `rareCritters.ts`의 레서판다 SVG는 보존합니다.

### 생성 프롬프트

Create a single production 2D game sprite for ROKE, an original RED PANDA grenadier animal special-forces character. The supplied wolf image is ONLY a reference for clean 2D linework, cel shading, high small-size readability and BIG HEAD / very short body proportions; do NOT copy the wolf species, colors or rifle. Roke is unmistakably an animal red panda: large rounded triangular ears with cream rims, rust-red fluffy head, broad cream eyebrows and cheek patches, short cream muzzle with a black nose, dark brown mask markings near the eyes, confident focused amber eyes, dark brown furry paw hands and chunky paw feet, and a very visible thick curled tail with alternating rust and deep brown rings. About 2 heads tall excluding ears, a dominant large expressive head, squat torso and short sturdy legs; face remains clearly visible above weapon. Strong cute battle-ready personality, not human with animal ears. Preserve his game identity: light cream/sand short tactical vest, sage green combat cap worn between the ears with a small brass badge, minimal warm gold accents, tan utility pouch. He carries a CHUNKY SHORT DRUM GRENADE LAUNCHER with dark slate/olive metal, cream outer casing, brass details, obvious revolving cylinder and a large round open muzzle; visually distinct from a long sniper rifle. Ready-to-fire three-quarter stance facing RIGHT, launcher barrel horizontal to right at chest level, both paws visibly supporting it, feet planted, tail curling out to left. Muzzle visible at right silhouette for attaching game effects. Full character and complete weapon uncropped, minimal even padding. Clean dark outline, flat colors with only two cel shaded tones per material, exactly the same crisp 2D animation aesthetic as reference. Fresh warm palette, no photorealism, no 3D rendering, no glossy plastic, no excessive costume detail. Genuine transparent alpha background. ONE character only, no text, no labels, no borders, no floor shadow, no muzzle flash, no smoke, no scene or other poses. This sprite is used both for battlefield and character portraits, preserve broad recognizable shapes at 48-64px.

## 랑랑 2D 시안 적용 (2026-10-16, T4.31)

사용자가 승인한 자체 늑대 스나이퍼 시안을 내장 `image_gen` 도구로 투명 이미지화했습니다. 타 게임 이미지나 외부 다운로드 에셋은 사용하지 않았습니다. 기존 `src/art/critters.ts`의 wolf SVG와 원래 장비는 그대로 보존했습니다.

| 파일 | 용도 |
| --- | --- |
| `docs/art/rangrang-concept.png` | 사용자 승인 원본 시안 보관 |
| `src/art/assets/wolfIdle.png` | 카드·정보창·상점·스킬 알림·드래그의 대기 자세 |
| `src/art/assets/wolfAim.png` | 첫 조준 자세 원본 보관 |
| `src/art/assets/wolfAimV2.png` | 머리 확대·몸/다리 축소한 인게임 조준 자세, 256×256 텍스처에 비율 유지하여 로드 |

생성 방식: built-in image_gen, 원본 시안을 `referenced_image_paths`로 제공, 두 이미지 모두 `transparent_background: true`. CLI/API fallback은 사용하지 않았습니다.

### 조준 이미지 프롬프트

Extract and faithfully recreate ONLY the small compact wolf sniper in the bottom right AIM pose of this approved design sheet as ONE standalone production-ready transparent 2D game sprite. Exact same character, blue-gray wolf fur, cream muzzle cheeks and tail tip, amber focused eyes, triangular ears, mint scarf, dark short tactical jacket/harness, tan pouch, cream-stock dark long scoped sniper rifle held with both paws pointing horizontally RIGHT. Keep the cute compact proportions of the BOTTOM RIGHT SMALL SPRITE, NOT the tall large figures. Full character from ears to planted paws, full tail left, full gun right, everything uncropped. No muzzle flash (game will render it), no smoke, no ground shadow, no panels, no labels, no extra poses, no swatches, no background. Actual transparent alpha background. Clean sharp dark outline and flat cel shading exactly matching the provided illustration; preserve its design rather than reimagining it. Center the full silhouette with minimal even padding, paws along the bottom. Landscape canvas matching full silhouette about 1.45 width to 1 height. Output only the one aiming sprite. This is for in-game billboard rendering at small sizes.

### 인게임 비율 수정 프롬프트 (T4.32)

기존 `wolfAim.png`를 편집 대상으로 내장 image_gen에 제공했습니다. `transparent_background: true`이며 카드용 대기 그림과 첫 조준 그림은 보존합니다.

Edit this existing wolf sniper sprite ONLY to improve small in-game readability through proportions. Preserve exactly the same wolf identity, blue-gray fur, cream muzzle and cheek tufts, focused amber eyes, black nose, mint scarf, dark tactical jacket, tan pouch, fluffy cream-tipped tail, and cream/dark scoped sniper rifle. Increase the entire HEAD including facial features by approximately 30 percent relative to the body; shorten and compress torso and legs to a compact 2 to 2.5 heads tall game sprite. Clearly bigger expressive wolf face and shorter sturdy animal legs, not just enlarged ears. Keep a serious capable sniper expression, not a baby. Keep the right-facing aiming stance, two paws supporting the rifle, stock at shoulder, both planted feet and tail visible. Slightly compact the rifle proportion if needed so the enlarged face is dominant, while retaining a recognizably long sniper barrel. Keep the same clean dark outlines, flat 2D cel shading, color palette and specific costume design. No redesign, no 3D, no human anatomy. Whole single character with all ears, paws, tail, muzzle and weapon uncropped. Aim horizontally RIGHT; no muzzle flash or smoke, no shadow, no lettering, no panels, no extras. Genuine transparent alpha background, minimal even padding. This is the revised production in-game sprite, not a concept sheet.

### 대기 이미지 프롬프트

Create ONE transparent-background game sprite faithfully extracted from the BOTTOM SMALL IDLE wolf sniper of the reference design sheet. Same compact cute but capable blue-gray wolf, cream projecting muzzle and cheeks, sharp amber eyes, triangular ears, fluffy tail with cream tip, furry paws, mint scarf, dark tactical short jacket/harness and tan pouch. Same cream-and-dark long scoped sniper rifle held diagonally down toward right with both paws, entire rifle visible. Use the proportions of the small bottom IDLE sprite, not the tall illustration. Full body all ears, tail, feet and gun uncropped; center entire silhouette, minimal padding. Square canvas, true transparent alpha, no ground shadow, no text, no labels, no panels, no other characters or poses. Keep the approved exact design, flat cel shades and clean dark 2D line art, not 3D or painterly. This will be the roster card and character information portrait.
