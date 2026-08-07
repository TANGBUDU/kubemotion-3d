import * as THREE from 'three';
import type { ClusterEntity, EntityStatus } from '../domain/types';
import type { GeometryCatalog, MaterialCatalog } from './catalogs';

export interface SceneEntityHandle {
  entity: ClusterEntity;
  root: THREE.Group;
  mesh: THREE.Mesh;
  selectionRing: THREE.Mesh;
  currentStatus: EntityStatus;
}

export class SceneObjectFactory {
  constructor(
    private readonly geometries: GeometryCatalog,
    private readonly materials: MaterialCatalog,
  ) {}

  create(entity: ClusterEntity): SceneEntityHandle {
    const root = new THREE.Group();
    root.userData.entityId = entity.id;
    const mesh = new THREE.Mesh(
      this.geometries.get(entity.visual.archetype),
      this.materials.get(entity.visual.archetype, entity.status),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (entity.visual.archetype === 'pod') mesh.rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x8bd3ff, depthTest: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.52;
    ring.visible = false;
    root.add(mesh, ring);
    return { entity, root, mesh, selectionRing: ring, currentStatus: entity.status };
  }

  update(handle: SceneEntityHandle, status: EntityStatus, emphasis: string): void {
    if (handle.currentStatus !== status) {
      handle.mesh.material = this.materials.get(handle.entity.visual.archetype, status);
      handle.currentStatus = status;
    }
    handle.root.scale.setScalar(emphasis === 'focused' ? 1.2 : emphasis === 'dimmed' ? 0.82 : 1);
    handle.mesh.renderOrder = emphasis === 'focused' ? 2 : 0;
  }
}
