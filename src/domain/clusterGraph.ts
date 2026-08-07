import type {
  ClusterEntity,
  ClusterGraph,
  ClusterRelation,
  ClusterSnapshot,
  EntityId,
} from './types';

function pushIndex<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

export function createClusterGraph(snapshot: ClusterSnapshot): ClusterGraph {
  const entityById = new Map<EntityId, ClusterEntity>();
  const outgoingByEntity = new Map<EntityId, ClusterRelation[]>();
  const incomingByEntity = new Map<EntityId, ClusterRelation[]>();
  const entitiesByKind = new Map<string, ClusterEntity[]>();
  const entitiesByNamespace = new Map<string, ClusterEntity[]>();
  const entitiesByNode = new Map<string, ClusterEntity[]>();

  for (const entity of snapshot.entities) {
    if (entityById.has(entity.id)) throw new Error(`Duplicate entity ID: ${entity.id}`);
    if (entity.scope === 'namespaced' && !entity.namespace) {
      throw new Error(`Namespaced entity is missing namespace: ${entity.id}`);
    }
    if (entity.scope === 'node' && !entity.nodeName) {
      throw new Error(`Node-scoped entity is missing nodeName: ${entity.id}`);
    }
    entityById.set(entity.id, entity);
    pushIndex(entitiesByKind, entity.kind, entity);
    if (entity.namespace) pushIndex(entitiesByNamespace, entity.namespace, entity);
    if (entity.nodeName) pushIndex(entitiesByNode, entity.nodeName, entity);
  }
  for (const relation of snapshot.relations) {
    const from = entityById.get(relation.from);
    const to = entityById.get(relation.to);
    if (!from || !to) throw new Error(`Relation ${relation.id} references a missing entity`);
    if (relation.type === 'scheduled-on' && (from.kind !== 'Pod' || to.kind !== 'Node')) {
      throw new Error(`Invalid scheduled-on relation: ${relation.id}`);
    }
    if (
      relation.type === 'owns' &&
      from.scope === 'namespaced' &&
      to.scope === 'namespaced' &&
      from.namespace !== to.namespace
    ) {
      throw new Error(`Cross-namespace ownership: ${relation.id}`);
    }
    pushIndex(outgoingByEntity, relation.from, relation);
    pushIndex(incomingByEntity, relation.to, relation);
  }
  return {
    snapshot,
    entityById,
    outgoingByEntity,
    incomingByEntity,
    entitiesByKind,
    entitiesByNamespace,
    entitiesByNode,
  };
}
