import {
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  type PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  type Texture,
  Vector3,
} from 'three';
import { assert } from '../core/assert';

const CAPACITY = 200;
const EXPANDING = new Set(['shellBurst', 'flameBloom', 'fireBurst', 'frostFlash']);
const IMAGES = [
  'bullet',
  'compactRound',
  'energyPulse',
  'stormBolt',
  'stormFlash',
  'flameBolt',
  'flameLink',
  'flameBloom',
  'crescentSlash',
  'hammerWave',
  'iceLance',
  'cometRound',
  'infernoRound',
  'chargedRail',
  'gravityCore',
  'iceRound',
  'arcBolt',
  'railRound',
  'fireball',
  'fireBurst',
  'impact',
  'plasmaImpact',
  'slash',
  'shockwave',
  'muzzle',
  'signal',
  'stickyDrop',
  'spark',
  'droplet',
  'goo',
  'stunStar',
  'ring',
  'mintRailRound',
  'shellRound',
  'shellBurst',
  'lightningLink',
  'frostFlash',
  'railFlash',
  'shellFlash',
  'skill-acornPickup',
  'skill-nyangCombo',
  'skill-potLidGuard',
  'skill-snowballBarrage',
  'skill-stardustShower',
  'skill-carrotSoup',
  'skill-tunnelAmbush',
  'skill-stickyRoad',
  'skill-wideBarrage',
  'skill-tripleAim',
  'skill-polarAim',
  'skill-siegeBarrage',
  'skill-stormChain',
  'gravityOrb',
  'gravityRing',
  'gravityBurst',
  'skill-eventHorizon',
];

export function createParticlePool(textures: ReadonlyMap<string, Texture>) {
  const group = new Group();
  const meshes = new Map<string, InstancedMesh<PlaneGeometry, ShaderMaterial>>();
  const flatRotation = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  const transform = new Object3D();
  const point = new Vector3();
  const particles = Array.from({ length: CAPACITY }, () => ({
    active: false,
    id: '',
    age: 0,
    duration: 1,
    size: 1,
    arc: 0,
    wave: false,
    aimed: false,
    beam: false,
    opacity: 1,
    from: new Vector3(),
    to: new Vector3(),
  }));
  let drawn = 0;
  for (const id of IMAGES) {
    const texture = textures.get(id);
    assert(texture, `이펙트 그림이 없습니다: ${id}`);
    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute(
      'aOpacity',
      new InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(DynamicDrawUsage),
    );
    const material = new ShaderMaterial({
      uniforms: { map: { value: texture } },
      transparent: true,
      depthWrite: false,
      vertexShader:
        'attribute float aOpacity; varying vec2 vUv; varying float vOpacity; void main() { vUv=uv; vOpacity=aOpacity; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vOpacity;
        void main(){ vec4 c=texture2D(map,vUv); if(c.a<0.05)discard; gl_FragColor=vec4(c.rgb,c.a*vOpacity);
        #include <colorspace_fragment>
        }`,
    });
    const mesh = new InstancedMesh(geometry, material, CAPACITY);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    meshes.set(id, mesh);
    group.add(mesh);
  }
  function draw(
    id: string,
    at: Vector3,
    size: number,
    opacity: number,
    camera: PerspectiveCamera,
    flat = false,
    angle = 0,
    length = size,
  ) {
    if (drawn >= CAPACITY) return;
    const mesh = meshes.get(id);
    if (!mesh) return;
    const index = mesh.count++;
    transform.position.copy(at);
    transform.scale.set(length, size, size);
    transform.quaternion.copy(flat ? flatRotation : camera.quaternion);
    if (!flat && angle !== 0) transform.rotateZ(angle);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.geometry.getAttribute('aOpacity').setX(index, opacity);
    drawn++;
  }
  return {
    group,
    get count() {
      return drawn;
    },
    emit(
      id: string,
      from: Vector3,
      to: Vector3,
      duration: number,
      size: number,
      arc = 0,
      wave = false,
      aimed = false,
      opacity = 1,
      beam = false,
      delay = 0,
    ) {
      const particle = particles.find((particle) => !particle.active);
      if (!particle) return;
      Object.assign(particle, {
        active: true,
        id,
        age: -delay,
        duration,
        size,
        arc,
        wave,
        aimed,
        opacity,
        beam,
      });
      particle.from.copy(from);
      particle.to.copy(to);
    },
    begin(dt: number, camera: PerspectiveCamera) {
      drawn = 0;
      for (const mesh of meshes.values()) mesh.count = 0;
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.age += dt;
        if (particle.age < 0) continue;
        if (particle.age >= particle.duration) {
          particle.active = false;
          continue;
        }
        const t = particle.age / particle.duration;
        const grenade = particle.id === 'shellRound' && particle.aimed;
        const explosion = EXPANDING.has(particle.id);
        const softBloom = particle.id === 'fireBurst' || particle.id === 'frostFlash';
        point.lerpVectors(particle.from, particle.to, particle.beam ? 0.5 : t);
        point.y += (grenade ? 4 * t * (1 - t) : Math.sin(t * Math.PI)) * particle.arc;
        let angle = 0;
        const scale = grenade
          ? 1
          : explosion
            ? (softBloom ? 0.75 : 0.65) + (softBloom ? 0.45 : 1.1) * Math.min(1, t * 3)
            : particle.wave
              ? 1 + 3 * t
              : 1 - 0.4 * t;
        let length = particle.size * scale;
        if (particle.aimed) {
          const dx = particle.to.x - particle.from.x;
          const dy = particle.to.y - particle.from.y + (grenade ? 4 * particle.arc * (1 - 2 * t) : 0);
          const dz = particle.to.z - particle.from.z;
          const m = camera.matrixWorldInverse.elements;
          const screenX = m[0] * dx + m[4] * dy + m[8] * dz;
          const screenY = m[1] * dx + m[5] * dy + m[9] * dz;
          angle = Math.atan2(screenY, screenX);
          if (particle.beam) length = Math.hypot(screenX, screenY);
        }
        draw(
          particle.id,
          point,
          particle.size * scale,
          (grenade ? 1 - t ** 8 : particle.aimed && !particle.beam ? 1 - t ** 3 : 1 - t) * particle.opacity,
          camera,
          particle.wave,
          angle,
          length,
        );
      }
    },
    draw,
    end() {
      for (const mesh of meshes.values()) {
        mesh.visible = mesh.count > 0;
        if (!mesh.visible) continue;
        // 실제 그린 인스턴스만 올려 스킬별 200칸 버퍼 전체 전송을 피합니다.
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16);
        mesh.instanceMatrix.needsUpdate = true;
        const opacity = mesh.geometry.getAttribute('aOpacity') as InstancedBufferAttribute;
        opacity.clearUpdateRanges();
        opacity.addUpdateRange(0, mesh.count);
        opacity.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of meshes.values()) {
        mesh.dispose();
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      meshes.clear();
      group.clear();
    },
  };
}
