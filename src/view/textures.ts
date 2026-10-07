import { CanvasTexture, SRGBColorSpace } from 'three';
import { assert } from '../core/assert';
import type { ContentDb, Role } from '../data/types';

function placeholder(label: string, color: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  assert(ctx, '캐릭터 그림을 그릴 수 없습니다');
  ctx.beginPath();
  ctx.arc(128, 132, 96, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fffdf5';
  ctx.stroke();
  ctx.font = 'bold 94px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffdf5';
  ctx.fillText(label, 128, 132);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createTextures(content: ContentDb, roleColors: Readonly<Record<Role, string>>) {
  const textures = new Map<string, CanvasTexture>();
  for (const unit of content.units.values())
    textures.set(unit.id, placeholder(unit.name.slice(0, 1), roleColors[unit.role]));
  for (const enemy of content.enemies.values())
    textures.set(
      enemy.id,
      placeholder(
        enemy.name.slice(0, 1),
        enemy.flying ? '#7962a6' : enemy.id === 'hardJelly' ? '#bc859b' : '#f184a2',
      ),
    );
  return {
    textures,
    dispose() {
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
