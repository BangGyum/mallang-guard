import { expect, it } from 'vitest';
import { VFX_IDS } from '../../src/art/vfxArt';
import { content } from '../../src/data';
import { WEAPON_VFX } from '../../src/view/weaponVfx';

it('14종 무기 탄체를 구분하고 실제로 구울 수 있는 그림에 연결한다', () => {
  const projectiles = new Set<string>();
  for (const unit of content.units.values()) {
    const shot = WEAPON_VFX[unit.id];
    expect(shot).toBeDefined();
    if (!shot) throw new Error(unit.id);
    for (const id of [shot.art, shot.impact, shot.debris, shot.skillArt, shot.skillImpact])
      if (id) expect(VFX_IDS).toContain(id);
    projectiles.add(shot.art);
  }
  expect(projectiles.size).toBe(14);
});
