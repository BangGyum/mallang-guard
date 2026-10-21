import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';

// 그림의 발 앵커를 원점으로 한 무기 끝. 배치 미리보기와 전장이 같은 크기를 사용합니다.
export const UNIT_PRESENTATION: Readonly<Record<string, { height: number; tip: readonly [number, number] }>> =
  {
    squirrel: { height: 1.1, tip: [0.421, 0.34] },
    mole: { height: 1.1, tip: [0.423, 0.325] },
    cat: { height: 1.1, tip: [0.481, 0.551] },
    bear: { height: 1.1, tip: [0.48, 0.46] },
    penguin: { height: 1.1, tip: [0.475, 0.298] },
    sheep: { height: 1.1, tip: [0.381, 0.48] },
    bunny: { height: 1.1, tip: [0.401, 0.294] },
    snail: { height: 1.1, tip: [0.454, 0.248] },
    owl: { height: 1.1, tip: [0.388, 0.507] },
    wolf: { height: 1.1, tip: [0.49, 0.325] },
    fox: { height: 1.1, tip: [0.49, 0.312] },
    redPanda: { height: 1.1, tip: [0.48, 0.312] },
    deer: { height: 1.1, tip: [0.395, 0.468] },
    snowLeopard: { height: 1.1, tip: [0.422, 0.314] },
  };

export function unitSpriteHeight(art: string): number {
  return UNIT_PRESENTATION[art]?.height ?? 0.9;
}

export function createSprite(texture: Texture, height: number, flying: boolean) {
  // 공통 발 앵커 (50, 93)를 월드 원점에 맞춥니다.
  const geometry = new PlaneGeometry(1, 1).translate(0, 0.43, 0);
  const material = new ShaderMaterial({
    uniforms: {
      map: { value: texture },
      uFlash: { value: 0 },
      uTint: { value: new Color('#ffffff') },
      uOpacity: { value: 1 },
    },
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float uFlash; uniform vec3 uTint; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(mix(c.rgb * uTint, vec3(1.0), uFlash), c.a * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
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
  const ring = new Mesh(
    new RingGeometry(0.31, 0.35, 32),
    new MeshBasicMaterial({ color: '#ffe279', transparent: true, opacity: 0.6, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  ring.visible = false;
  group.add(sprite, shadow, ring);
  return {
    group,
    sprite,
    shadow,
    ring,
    dispose() {
      geometry.dispose();
      material.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    },
  };
}
