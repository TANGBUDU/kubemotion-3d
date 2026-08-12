import * as THREE from 'three';
import type { ResolvedAnimationContext } from './contracts';
import type { ActiveCue } from './contracts';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;
export const easeInOutCubic = (value: number): number =>
  value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;

interface MaterialBaseline {
  readonly material: THREE.Material;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly depthWrite: boolean;
}

const materialsOf = (root: THREE.Object3D): readonly THREE.Material[] => {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const candidate = object as THREE.Object3D & {
      readonly material?: THREE.Material | readonly THREE.Material[];
    };
    if (Array.isArray(candidate.material)) {
      for (const material of candidate.material) materials.add(material);
    } else if (candidate.material instanceof THREE.Material) {
      materials.add(candidate.material);
    }
  });
  return [...materials];
};

/** Snapshot only the properties animation handlers are allowed to mutate. */
export class VisualBaseline {
  private readonly position: THREE.Vector3;
  private readonly quaternion: THREE.Quaternion;
  private readonly scale: THREE.Vector3;
  private readonly visible: boolean;
  private readonly materials: readonly MaterialBaseline[];

  public constructor(private readonly root: THREE.Object3D) {
    this.position = root.position.clone();
    this.quaternion = root.quaternion.clone();
    this.scale = root.scale.clone();
    this.visible = root.visible;
    this.materials = materialsOf(root).map((material) => ({
      material,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    }));
  }

  public setScaleFactor(x: number, y = x, z = x): void {
    this.root.scale.set(this.scale.x * x, this.scale.y * y, this.scale.z * z);
  }

  public setPositionOffset(offset: THREE.Vector3): void {
    this.root.position.copy(this.position).add(offset);
  }

  public setOpacityFactor(factor: number): void {
    const normalized = clamp01(factor);
    for (const baseline of this.materials) {
      baseline.material.opacity = baseline.opacity * normalized;
      baseline.material.transparent = baseline.transparent || normalized < 1;
      baseline.material.depthWrite = normalized >= 1 ? baseline.depthWrite : false;
      baseline.material.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  public restore(): void {
    this.root.position.copy(this.position);
    this.root.quaternion.copy(this.quaternion);
    this.root.scale.copy(this.scale);
    this.root.visible = this.visible;
    for (const baseline of this.materials) {
      baseline.material.opacity = baseline.opacity;
      baseline.material.transparent = baseline.transparent;
      baseline.material.depthWrite = baseline.depthWrite;
      baseline.material.needsUpdate = true;
    }
  }

  public get wasVisible(): boolean {
    return this.visible;
  }
}

type ActiveState = 'idle' | 'running' | 'finished' | 'cancelled' | 'disposed';

/** Shared idempotent lifecycle implementation for one time-based cue. */
export abstract class TimedActiveCue implements ActiveCue {
  private state: ActiveState = 'idle';
  private readonly startedAt: number;
  private readonly delayMs: number;
  private effectsStarted = false;
  public readonly durationMs: number;

  protected constructor(
    requestedDurationMs: number,
    protected readonly context: ResolvedAnimationContext,
    requestedDelayMs = 0,
  ) {
    this.startedAt = context.now();
    this.delayMs = context.reducedMotion ? 0 : Math.max(0, requestedDelayMs);
    this.durationMs = context.reducedMotion ? 1 : Math.max(1, requestedDurationMs);
  }

  private startEffects(): void {
    if (this.effectsStarted) return;
    this.effectsStarted = true;
    this.onStart();
  }

  public begin(): this {
    if (this.state !== 'idle') return this;
    this.state = 'running';
    // Establish the authored "before" visual immediately; delay only gates progression.
    // This prevents the already-synced final world from flashing before a causal effect begins.
    this.startEffects();
    this.context.markDirty?.();
    return this;
  }

  public update(now: number): boolean {
    if (this.state !== 'running') return false;
    const elapsed = Math.max(0, now - this.startedAt);
    if (elapsed < this.delayMs) return true;
    this.startEffects();
    const linearProgress = clamp01((elapsed - this.delayMs) / this.durationMs);
    this.onUpdate(this.easing(linearProgress), linearProgress);
    this.context.markDirty?.();
    return linearProgress < 1;
  }

  public finish(): void {
    if (this.state !== 'running') return;
    this.startEffects();
    this.onUpdate(1, 1);
    this.onFinish();
    this.state = 'finished';
    this.context.markDirty?.();
  }

  public cancel(): void {
    if (this.state !== 'running') return;
    this.onCancel();
    this.state = 'cancelled';
    this.context.markDirty?.();
  }

  public dispose(): void {
    if (this.state === 'disposed') return;
    if (this.state === 'running') this.cancel();
    this.onDispose();
    this.state = 'disposed';
  }

  protected easing(progress: number): number {
    return easeInOutCubic(progress);
  }

  protected onStart(): void {}
  protected abstract onUpdate(progress: number, linearProgress: number): void;
  protected abstract onFinish(): void;
  protected abstract onCancel(): void;
  protected onDispose(): void {}
}

export class NoopActiveCue implements ActiveCue {
  public update(): boolean {
    return false;
  }
  public finish(): void {}
  public cancel(): void {}
  public dispose(): void {}
}

export type TokenStyle = 'data-packet' | 'dns-query' | 'api-request' | 'reconcile' | 'scheduler';

const TOKEN_COLORS: Readonly<Record<TokenStyle, number>> = {
  'data-packet': 0x5eb6ff,
  'dns-query': 0x45d6d0,
  'api-request': 0xb792ff,
  reconcile: 0xb792ff,
  scheduler: 0x45d6d0,
};

export interface TokenLease {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  release(): void;
}

/** Owns the geometry and all per-token materials; release returns a token for replay reuse. */
export class AnimationTokenPool {
  private readonly geometry = new THREE.SphereGeometry(0.16, 12, 8);
  private readonly available: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly leased = new Set<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
  private readonly owned = new Set<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
  private disposed = false;

  public constructor(private readonly scene: THREE.Scene) {}

  public acquire(style: TokenStyle): TokenLease {
    if (this.disposed) throw new Error('Cannot acquire a token from a disposed animation pool.');
    const mesh = this.available.pop() ?? this.createToken();
    mesh.material.color.setHex(TOKEN_COLORS[style]);
    mesh.material.opacity = 1;
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.needsUpdate = true;
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
    mesh.userData.animationTokenStyle = style;
    this.leased.add(mesh);
    this.scene.add(mesh);
    let released = false;
    return {
      mesh,
      release: () => {
        if (released) return;
        released = true;
        this.release(mesh);
      },
    };
  }

  private createToken(): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = 'animation-token';
    mesh.userData.selectable = false;
    this.owned.add(mesh);
    return mesh;
  }

  private release(mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>): void {
    if (!this.leased.delete(mesh)) return;
    mesh.removeFromParent();
    mesh.visible = false;
    mesh.material.opacity = 1;
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    this.available.push(mesh);
  }

  public get pooledCount(): number {
    return this.available.length;
  }

  public get leasedCount(): number {
    return this.leased.size;
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

export const pointAlongPath = (
  points: readonly THREE.Vector3[],
  progress: number,
  target: THREE.Vector3,
): THREE.Vector3 => {
  if (points.length === 0) return target.set(0, 0, 0);
  if (points.length === 1) return target.copy(points[0] ?? new THREE.Vector3());
  const scaled = clamp01(progress) * (points.length - 1);
  const segmentIndex = Math.min(points.length - 2, Math.floor(scaled));
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1];
  if (!from || !to) return target.copy(points.at(-1) ?? new THREE.Vector3());
  return target.lerpVectors(from, to, scaled - segmentIndex);
};
