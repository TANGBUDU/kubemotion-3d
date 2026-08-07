import type { ClusterSnapshot } from '../domain/types';

export interface ClusterSnapshotProvider {
  readonly id: string;
  loadSnapshot(signal?: AbortSignal): Promise<ClusterSnapshot>;
}
