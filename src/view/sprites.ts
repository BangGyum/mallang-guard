import { CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Texture } from 'three';

export function createSprite(texture: Texture, height: number, flying: boolean) {
  const geometry = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const material = new MeshBasicMaterial({ map: texture, alphaTest: 0.5 });
  const sprite = new Mesh(geometry, material);
  sprite.scale.setScalar(height);
  const shadowGeometry = new CircleGeometry(0.28, 24);
  const shadowMaterial = new MeshBasicMaterial({
    color: '#241c30',
    transparent: true,
    opacity: flying ? 0.14 : 0.22,
    depthWrite: false,
  });
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.y = 0.65;
  const group = new Group();
  group.add(sprite, shadow);
  return {
    group,
    sprite,
    shadow,
    dispose() {
      geometry.dispose();
      material.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
    },
  };
}
