import type { ClusterSnapshot } from '../domain/types';
import type { ClusterSnapshotProvider } from './ClusterSnapshotProvider';

export class StaticScenarioProvider implements ClusterSnapshotProvider {
  readonly id: string;
  constructor(private readonly snapshot: ClusterSnapshot) {
    this.id = `static:${snapshot.id}`;
  }
  loadSnapshot(signal?: AbortSignal): Promise<ClusterSnapshot> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return Promise.resolve(this.snapshot);
  }
}
