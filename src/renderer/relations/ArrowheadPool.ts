import * as THREE from 'three';
import { directionAtEnd } from './polyline';

export interface ArrowheadAppearance {
  readonly color: number;
  readonly opacity: number;
  readonly renderOrder: number;
  readonly scale?: number;
}

export interface ArrowheadLease {
  readonly object: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  place(position: THREE.Vector3, direction: THREE.Vector3): void;
  placeAtRouteEnd(points: readonly THREE.Vector3[]): void;
  setAppearance(appearance: ArrowheadAppearance): void;
  setVisible(visible: boolean): void;
  release(): void;
}

/** Shared cone geometry with pooled, independently mutable materials. */
export class ArrowheadPool {
  private readonly geometry = new THREE.ConeGeometry(0.13, 0.38, 12);
  private readonly available: Array<THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly leased = new Set<THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>>();
  private readonly owned = new Set<THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>>();
  private disposed = false;

  public constructor(private readonly defaultParent: THREE.Object3D) {}

  public acquire(
    appearance: ArrowheadAppearance,
    parent: THREE.Object3D = this.defaultParent,
  ): ArrowheadLease {
    if (this.disposed) throw new Error('Cannot acquire an arrowhead from a disposed pool.');
    const mesh = this.available.pop() ?? this.create();
    this.leased.add(mesh);
    parent.add(mesh);
    mesh.visible = true;
    this.applyAppearance(mesh, appearance);
    let released = false;
    return {
      object: mesh,
      place: (position, direction) => {
        if (direction.lengthSq() <= Number.EPSILON) {
          throw new Error('Arrowhead direction must be non-zero.');
        }
        const normalized = direction.clone().normalize();
        mesh.position.copy(position).addScaledVector(normalized, -0.18 * mesh.scale.y);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalized);
      },
      placeAtRouteEnd: (points) => {
        const end = points.at(-1);
        if (!end || points.length < 2) {
          throw new Error('Arrowheads require a route with at least two points.');
        }
        const direction = directionAtEnd(points);
        mesh.position.copy(end).addScaledVector(direction, -0.18 * mesh.scale.y);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      },
      setAppearance: (next) => this.applyAppearance(mesh, next),
      setVisible: (visible) => {
        mesh.visible = visible;
      },
      release: () => {
        if (released) return;
        released = true;
        this.release(mesh);
      },
    };
  }

  private create(): THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial> {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = 'route-arrowhead';
    mesh.userData.selectable = false;
    this.owned.add(mesh);
    return mesh;
  }

  private applyAppearance(
    mesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>,
    appearance: ArrowheadAppearance,
  ): void {
    mesh.material.color.setHex(appearance.color);
    mesh.material.opacity = Math.min(1, Math.max(0, appearance.opacity));
    mesh.material.transparent = mesh.material.opacity < 1;
    mesh.material.needsUpdate = true;
    mesh.renderOrder = appearance.renderOrder;
    mesh.scale.setScalar(appearance.scale ?? 1);
  }

  private release(mesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>): void {
    if (!this.leased.delete(mesh)) return;
    mesh.removeFromParent();
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    delete mesh.userData.routeId;
    this.available.push(mesh);
  }

  public get leasedCount(): number {
    return this.leased.size;
  }

  public get pooledCount(): number {
    return this.available.length;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.owned) {
      mesh.removeFromParent();
      mesh.material.dispose();
    }
    this.geometry.dispose();
    this.available.length = 0;
    this.leased.clear();
    this.owned.clear();
  }
}
