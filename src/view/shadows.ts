import { CircleGeometry, Group, InstancedMesh, MeshBasicMaterial, Object3D, type Vector3 } from 'three';

export function createShadows() {
  const group = new Group();
  const geometry = new CircleGeometry(0.28, 20).rotateX(-Math.PI / 2);
  const meshes = [0.22, 0.14].map(
    (opacity) =>
      new InstancedMesh(
        geometry,
        new MeshBasicMaterial({ color: '#241c30', transparent: true, opacity, depthWrite: false }),
        128,
      ),
  );
  for (const mesh of meshes) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const transform = new Object3D();
  return {
    group,
    begin() {
      for (const mesh of meshes) mesh.count = 0;
    },
    add(position: Vector3, flying: boolean, lift: number, opacity: number) {
      const mesh = meshes[flying ? 1 : 0];
      if (!mesh || mesh.count >= 128) return;
      transform.position.copy(position);
      transform.position.y += 0.012;
      transform.scale.set((1 - Math.max(0, lift) * 0.2) * opacity, 1, 0.65 * opacity);
      transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, transform.matrix);
    },
    end() {
      for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      for (const mesh of meshes) {
        mesh.dispose();
        mesh.material.dispose();
      }
      group.clear();
    },
  };
}
