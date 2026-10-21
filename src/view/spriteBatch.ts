import {
  type Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';

export function createSpriteBatch(textures: ReadonlyMap<string, Texture>) {
  const group = new Group();
  const meshes = new Map<string, InstancedMesh<PlaneGeometry, ShaderMaterial>>();
  for (const [id, texture] of textures) {
    const geometry = new PlaneGeometry(1, 1).translate(0, 0.43, 0);
    geometry.setAttribute('aFlash', new InstancedBufferAttribute(new Float32Array(128), 1));
    geometry.setAttribute('aOpacity', new InstancedBufferAttribute(new Float32Array(128), 1));
    geometry.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(128 * 3), 3));
    const material = new ShaderMaterial({
      uniforms: { map: { value: texture } },
      transparent: true,
      depthWrite: true,
      side: DoubleSide,
      vertexShader: `attribute float aFlash; attribute float aOpacity; attribute vec3 aTint;
        varying vec2 vUv; varying float vFlash; varying float vOpacity; varying vec3 vTint;
        void main(){ vUv=uv; vFlash=aFlash; vOpacity=aOpacity; vTint=aTint;
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vFlash; varying float vOpacity; varying vec3 vTint;
        void main(){ vec4 c=texture2D(map,vUv); if(c.a<0.5 || vOpacity<0.01)discard;
          gl_FragColor=vec4(mix(c.rgb*vTint,vec3(1.0),vFlash),c.a*vOpacity);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new InstancedMesh(geometry, material, 128);
    mesh.count = 0;
    mesh.frustumCulled = false;
    meshes.set(id, mesh);
    group.add(mesh);
  }
  return {
    group,
    begin() {
      for (const mesh of meshes.values()) mesh.count = 0;
    },
    add(id: string, matrix: Matrix4, flash: number, opacity: number, tint: Color) {
      const mesh = meshes.get(id);
      if (!mesh || mesh.count >= 128) return;
      const index = mesh.count++;
      mesh.setMatrixAt(index, matrix);
      mesh.geometry.getAttribute('aFlash').setX(index, flash);
      mesh.geometry.getAttribute('aOpacity').setX(index, opacity);
      mesh.geometry.getAttribute('aTint').setXYZ(index, tint.r, tint.g, tint.b);
    },
    end() {
      for (const mesh of meshes.values()) {
        mesh.instanceMatrix.needsUpdate = true;
        for (const name of ['aFlash', 'aOpacity', 'aTint'])
          mesh.geometry.getAttribute(name).needsUpdate = true;
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
