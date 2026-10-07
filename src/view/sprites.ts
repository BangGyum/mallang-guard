import {
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';

export function createSprite(texture: Texture, height: number, flying: boolean) {
  // SVG의 발 앵커 (50, 93)를 월드 원점에 맞춥니다.
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
