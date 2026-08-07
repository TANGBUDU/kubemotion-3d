import type { Scene } from 'three';
import type { ClusterEntity, EntityId } from '../domain/types';
import type { SceneEntityHandle, SceneObjectFactory } from './SceneObjectFactory';

export class SceneRegistry {
  private readonly handles = new Map<EntityId, SceneEntityHandle>();

  constructor(
    private readonly scene: Scene,
    private readonly factory: SceneObjectFactory,
  ) {}

  get(entityId: EntityId): SceneEntityHandle | undefined {
    return this.handles.get(entityId);
  }
  ensure(entity: ClusterEntity): SceneEntityHandle {
    const current = this.handles.get(entity.id);
    if (current) return current;
    const handle = this.factory.create(entity);
    this.handles.set(entity.id, handle);
    this.scene.add(handle.root);
    return handle;
  }
  remove(entityId: EntityId): void {
    const handle = this.handles.get(entityId);
    if (!handle) return;
    this.scene.remove(handle.root);
    this.handles.delete(entityId);
  }
  clear(): void {
    for (const id of [...this.handles.keys()]) this.remove(id);
  }
  values(): Iterable<SceneEntityHandle> {
    return this.handles.values();
  }
  get size(): number {
    return this.handles.size;
  }
}
