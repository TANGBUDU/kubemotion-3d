import type { EntitySelector } from './types';
import type { ClusterEntity, ClusterGraph } from '../domain/types';

export function selectEntities(graph: ClusterGraph, selector: EntitySelector): ClusterEntity[] {
  if ('byIds' in selector) {
    return selector.byIds.flatMap((id) => {
      const entity = graph.entityById.get(id);
      return entity ? [entity] : [];
    });
  }
  if ('byKind' in selector) {
    return [...(graph.entitiesByKind.get(selector.byKind) ?? [])].filter(
      (entity) => !selector.namespace || entity.namespace === selector.namespace,
    );
  }
  if ('byLabel' in selector) {
    return graph.snapshot.entities.filter(
      (entity) =>
        entity.labels?.[selector.byLabel.key] === selector.byLabel.value &&
        (!selector.namespace || entity.namespace === selector.namespace),
    );
  }
  if ('byCategory' in selector) {
    return graph.snapshot.entities.filter((entity) => entity.category === selector.byCategory);
  }
  return [...(graph.entitiesByNode.get(selector.byNode) ?? [])];
}
