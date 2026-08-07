import * as THREE from 'three';
import type { EntityId } from '../../world/types';
import type { LayoutResult } from '../LayoutEngine';
import type { EntityVisualHandle } from '../VisualHandles';

interface LayoutMotionEntry {
  readonly entityId: EntityId;
  readonly root: THREE.Object3D;
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Captures one authored previous-to-final layout change after the factual world has been synced.
 * It owns no renderer resources and settling it repeatedly is safe.
 */
export class CapturedLayoutTransition {
  private readonly scratch = new THREE.Vector3();

  public constructor(private readonly entries: readonly LayoutMotionEntry[]) {}

  public apply(progress: number): void {
    const normalized = clamp01(progress);
    for (const entry of this.entries) {
      if (entry.root.userData.activeWorld !== true) continue;
      entry.root.position.copy(this.scratch.lerpVectors(entry.from, entry.to, normalized));
      entry.root.updateWorldMatrix(true, true);
    }
  }

  public finish(): void {
    this.apply(1);
  }

  public get size(): number {
    return this.entries.length;
  }

  public get entityIds(): readonly EntityId[] {
    return this.entries.map((entry) => entry.entityId);
  }
}

export function captureLayoutTransition(
  previous: LayoutResult,
  final: LayoutResult,
  entityIds: readonly EntityId[],
  getEntity: (entityId: EntityId) => EntityVisualHandle | undefined,
): CapturedLayoutTransition | undefined {
  const entries: LayoutMotionEntry[] = [];
  for (const entityId of [...new Set(entityIds)]) {
    const from = previous.positions.get(entityId);
    const to = final.positions.get(entityId);
    const handle = getEntity(entityId);
    if (!from || !to || !handle || handle.isDisposed) continue;
    const fromVector = new THREE.Vector3(...from);
    const toVector = new THREE.Vector3(...to);
    if (fromVector.distanceToSquared(toVector) < 1e-8) continue;
    entries.push({ entityId, root: handle.root, from: fromVector, to: toVector });
  }
  return entries.length > 0 ? new CapturedLayoutTransition(entries) : undefined;
}
