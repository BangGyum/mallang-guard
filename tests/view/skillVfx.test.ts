import { InstancedMesh, PerspectiveCamera, Texture, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VFX_IDS, vfxSvg } from '../../src/art/vfxArt';
import { skillStartSound } from '../../src/audio/skillSounds';
import { assert } from '../../src/core/assert';
import { content } from '../../src/data';
import { hashState } from '../../src/sim/hash';
import { rangeTilesFor } from '../../src/sim/queries';
import type { SimEvent } from '../../src/sim/types';
import { skillMark } from '../../src/view/skillVfx';
import { createVfx } from '../../src/view/vfx';
import { rareFixture } from '../sim/rareFixtures';

beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }));
afterEach(() => vi.unstubAllGlobals());

function fixture(id: string) {
  const f = rareFixture(id);
  f.unit.skillState = f.skill.durationSec > 0 ? 'active' : 'charging';
  f.unit.buffs = f.skill.effects;
  const textures = new Map(
    VFX_IDS.map((id) => {
      const texture = new Texture();
      texture.name = id;
      return [id, texture] as const;
    }),
  );
  const camera = new PerspectiveCamera();
  const vfx = createVfx(
    f.content,
    f.stage.board,
    textures,
    () => new Vector3(0, 1, 0),
    () => new Vector3(),
  );
  const mesh = (id: string) => {
    const found = vfx.group.children.find(
      (node) => node instanceof InstancedMesh && node.material.uniforms.map?.value.name === id,
    );
    assert(found instanceof InstancedMesh, '스킬 이펙트 메시 없음');
    return found;
  };
  return {
    ...f,
    vfx,
    camera,
    mesh,
    start() {
      vfx.onEvents([{ type: 'skillStart', uid: f.unit.uid, skillId: f.skill.id }], f.state, new Map());
    },
    dispose() {
      vfx.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}

describe('유닛별 스킬 피드백', () => {
  it('로크는 스킬 발동만으로 유탄을 쏘지 않고 포격 표식을 펼친다', () => {
    const f = fixture('redPanda');
    try {
      f.start();
      f.vfx.update(f.state, f.camera, 0.08);
      expect(f.mesh('shellRound').count).toBe(0);
      expect(f.mesh('shellBurst').count).toBe(0);
      expect(f.mesh('skill-siegeBarrage').count).toBeGreaterThan(2);
    } finally {
      f.dispose();
    }
  });
  it.each(content.unitOrder.filter((id) => id !== 'mole'))(
    '%s의 파편 종류와 무관하게 스킬 명중 문양이 도착 시 표시되고 조용한 모드에서는 생략된다',
    (id) => {
      for (const mode of ['normal', 'reduced', 'low']) {
        const f = fixture(id);
        try {
          f.vfx.setOptions(mode === 'reduced', mode === 'low');
          f.vfx.onEvents(
            [
              {
                type: 'attack',
                src: { kind: 'unit', uid: f.unit.uid },
                dst: { kind: 'enemy', uid: 100 },
                damageType: f.def.damageType,
                ranged: true,
              },
            ],
            f.state,
            new Map(),
          );
          f.vfx.update(f.state, f.camera, 0.24);
          expect(f.mesh(skillMark(f.skill.id)).count).toBe(1);
          f.vfx.update(f.state, f.camera, 0.02);
          expect(f.mesh(skillMark(f.skill.id)).count).toBe(mode === 'normal' ? (id === 'fox' ? 3 : 2) : 1);
          f.vfx.update(f.state, f.camera, 0.3);
          expect(f.mesh(skillMark(f.skill.id)).count).toBe(1);
        } finally {
          f.dispose();
        }
      }
    },
  );
  it('현재 모든 스킬 표식·음원 연결에 누락과 중복이 없다', () => {
    const skills = [...content.skills.values()];
    const marks = skills.map((skill) => skillMark(skill.id));
    const sounds = skills.map((skill) => skillStartSound(skill.id));
    expect(new Set(marks).size).toBe(skills.length);
    expect(new Set(sounds).size).toBe(skills.length);
    expect(sounds).not.toContain(undefined);
    for (const mark of marks) {
      expect(VFX_IDS).toContain(mark);
      expect(vfxSvg(mark as (typeof VFX_IDS)[number])).toContain('<svg');
    }
    expect(skillMark('unknown')).toBe('ring');
    expect(skillStartSound('unknown')).toBeUndefined();
  });

  it.each(content.unitOrder)('%s 발동·정지·만료 표시는 전투 상태를 바꾸지 않는다', (id) => {
    const f = fixture(id);
    try {
      const before = hashState(f.state);
      f.start();
      f.vfx.update(f.state, f.camera, 0.08);
      expect(f.mesh(skillMark(f.skill.id)).count).toBeGreaterThan(0);
      // 발동 문양이 얼굴 중심(검사 위치 y=1)을 덮지 않습니다.
      expect(f.mesh(skillMark(f.skill.id)).instanceMatrix.array[13]).toBeGreaterThan(1.5);
      const snapshot = () =>
        f.vfx.group.children.map((node) => {
          assert(node instanceof InstancedMesh, '파티클 메시 없음');
          return {
            count: node.count,
            matrix: [...node.instanceMatrix.array],
            opacity: [...node.geometry.getAttribute('aOpacity').array],
          };
        });
      const paused = snapshot();
      f.vfx.update(f.state, f.camera, 0);
      expect(snapshot()).toEqual(paused);
      expect(hashState(f.state)).toBe(before);
      f.vfx.update(f.state, f.camera, 0.5);
      expect(f.mesh(skillMark(f.skill.id)).count).toBe(f.skill.durationSec > 0 ? 1 : 0);
      f.unit.skillState = 'charging';
      f.unit.buffs = [];
      f.vfx.update(f.state, f.camera, 0);
      expect(f.mesh(skillMark(f.skill.id)).count).toBe(0);
    } finally {
      f.dispose();
    }
  });

  it.each(['reduced', 'low'])('%s에서는 작은 발동 표식과 고정된 활성 표식만 남긴다', (mode) => {
    const f = fixture('owl');
    try {
      f.vfx.setOptions(mode === 'reduced', mode === 'low');
      f.start();
      f.vfx.update(f.state, f.camera, 0.1);
      expect(f.vfx.count).toBe(2);
      expect(f.mesh('fireBurst').count).toBe(0);
      f.vfx.update(f.state, f.camera, 0.5);
      const matrix = [...f.mesh(skillMark(f.skill.id)).instanceMatrix.array];
      f.vfx.update(f.state, f.camera, 0.5);
      expect([...f.mesh(skillMark(f.skill.id)).instanceMatrix.array]).toEqual(matrix);
    } finally {
      f.dispose();
    }
  });

  it('전술 가속의 지원 신호는 실제 사거리 안의 아군에게만 표시한다', () => {
    const f = fixture('bunny');
    try {
      const tiles = rangeTilesFor(f.content, f.stage, f.unit.unitId, f.unit.tile, f.unit.dir, f.unit.buffs);
      assert(tiles[0], '가속 사거리 없음');
      f.state.units.push({ ...f.unit, uid: 2, tile: tiles[0] }, { ...f.unit, uid: 3, tile: { x: 0, y: 0 } });
      f.start();
      f.vfx.update(f.state, f.camera, 0.05);
      expect(f.mesh('signal').count).toBe(3);
    } finally {
      f.dispose();
    }
  });

  it('동시 발동에도 200개 한도를 지키고 종료하면 메시를 정리한다', () => {
    const f = fixture('fox');
    for (let i = 0; i < 100; i++) f.start();
    f.vfx.update(f.state, f.camera, 0.05);
    expect(f.vfx.count).toBeLessThanOrEqual(200);
    f.dispose();
    expect(f.vfx.group.children).toHaveLength(0);
  });

  it.each([
    ['penguin', 'frostFlash'],
    ['sheep', 'plasmaImpact'],
    ['fox', 'chargedRail'],
    ['redPanda', 'shellFlash'],
    ['deer', 'flameBloom'],
  ])('%s는 스킬 중 전용 총구 효과를 한 번 표시하고 만료한다', (id, flash) => {
    assert(id && flash, '총구 검사 정의 없음');
    const f = fixture(id);
    try {
      const event: SimEvent = {
        type: 'attack',
        src: { kind: 'unit', uid: f.unit.uid },
        dst: { kind: 'enemy', uid: 100 },
        damageType: f.def.damageType,
        ranged: true,
      };
      const before = hashState(f.state);
      f.vfx.onEvents([event, event], f.state, new Map());
      f.vfx.update(f.state, f.camera, 0.02);
      expect(f.mesh(flash).count).toBe(id === 'fox' ? 3 : 1);
      expect(hashState(f.state)).toBe(before);
      f.vfx.update(f.state, f.camera, 0.1);
      expect(f.mesh(flash).count).toBe(id === 'fox' ? 2 : 0);
    } finally {
      f.dispose();
    }
  });
});
