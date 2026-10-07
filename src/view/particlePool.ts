import {
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
const IMAGES = [
  'snowball',
  'star',
  'stickyDrop',
  'heartPlus',
  'spark',
  'droplet',
  'goo',
  'stunStar',
  'acorn',
  'carrot',
  'ring',
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
    from: new Vector3(),
    to: new Vector3(),
  }));
  let drawn = 0;
  for (const id of IMAGES) {
    const texture = textures.get(id);
    assert(texture, `이펙트 그림이 없습니다: ${id}`);
    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute('aOpacity', new InstancedBufferAttribute(new Float32Array(CAPACITY), 1));
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
  ) {
    if (drawn >= CAPACITY) return;
    const mesh = meshes.get(id);
    if (!mesh) return;
    const index = mesh.count++;
    transform.position.copy(at);
    transform.scale.setScalar(size);
    transform.quaternion.copy(flat ? flatRotation : camera.quaternion);
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
    emit(id: string, from: Vector3, to: Vector3, duration: number, size: number, arc = 0, wave = false) {
      const particle = particles.find((particle) => !particle.active);
      if (!particle) return;
      Object.assign(particle, { active: true, id, age: 0, duration, size, arc, wave });
      particle.from.copy(from);
      particle.to.copy(to);
    },
    begin(dt: number, camera: PerspectiveCamera) {
      drawn = 0;
      for (const mesh of meshes.values()) mesh.count = 0;
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.age += dt;
        if (particle.age >= particle.duration) {
          particle.active = false;
          continue;
        }
        const t = particle.age / particle.duration;
        point.lerpVectors(particle.from, particle.to, t);
        point.y += Math.sin(t * Math.PI) * particle.arc;
        draw(
          particle.id,
          point,
          particle.size * (particle.wave ? 1 + 3 * t : 1 - 0.4 * t),
          1 - t,
          camera,
          particle.wave,
        );
      }
    },
    draw,
    end() {
      for (const mesh of meshes.values()) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute('aOpacity').needsUpdate = true;
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
