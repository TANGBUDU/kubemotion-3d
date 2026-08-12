import * as THREE from 'three';
import { samplePolyline } from './polyline';

export interface FlowTokenAppearance {
  readonly color: number;
  readonly opacity: number;
  readonly renderOrder: number;
  readonly scale?: number;
}

export interface FlowTokenLease {
  readonly object: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  setProgress(
    points: readonly THREE.Vector3[],
    progress: number,
    direction?: 'forward' | 'reverse',
  ): void;
  setAppearance(appearance: FlowTokenAppearance): void;
  setVisible(visible: boolean): void;
  release(): void;
}

/** Supplemental motion tokens. The persistent Line2 route remains authoritative and visible. */
export class FlowTokenPool {
  private readonly geometry = new THREE.OctahedronGeometry(0.16, 0);
  private readonly available: Array<THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>> =
    [];
  private readonly leased = new Set<
    THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>
  >();
  private readonly owned = new Set<THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>>();
  private disposed = false;

  public constructor(private readonly defaultParent: THREE.Object3D) {}

  public acquire(
    appearance: FlowTokenAppearance,
    parent: THREE.Object3D = this.defaultParent,
  ): FlowTokenLease {
    if (this.disposed) throw new Error('Cannot acquire a flow token from a disposed pool.');
    const mesh = this.available.pop() ?? this.create();
    this.leased.add(mesh);
    parent.add(mesh);
    mesh.visible = true;
    this.applyAppearance(mesh, appearance);
    let released = false;
    return {
      object: mesh,
      setProgress: (points, progress, direction = 'forward') => {
        samplePolyline(points, progress, mesh.position);
        const sampleOffset = direction === 'reverse' ? -0.01 : 0.01;
        const next = samplePolyline(points, Math.min(1, Math.max(0, progress + sampleOffset)));
        const tangent = next.sub(mesh.position);
        if (tangent.lengthSq() > Number.EPSILON) {
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
        }
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

  private create(): THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial> {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = 'route-flow-token';
    mesh.userData.selectable = false;
    this.owned.add(mesh);
    return mesh;
  }

  private applyAppearance(
    mesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>,
    appearance: FlowTokenAppearance,
  ): void {
    mesh.material.color.setHex(appearance.color);
    mesh.material.opacity = Math.min(1, Math.max(0, appearance.opacity));
    mesh.material.transparent = mesh.material.opacity < 1;
    mesh.material.needsUpdate = true;
    mesh.renderOrder = appearance.renderOrder;
    mesh.scale.setScalar(appearance.scale ?? 1);
  }

  private release(mesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>): void {
    if (!this.leased.delete(mesh)) return;
    mesh.removeFromParent();
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    delete mesh.userData.routeId;
    delete mesh.userData.requestId;
    delete mesh.userData.flowPhase;
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
