import type { ExploreFilters } from '../state/appStore';
import type { ClusterGraph, EntityId, RelationId } from '../domain/types';
import type { EntityProjection, SceneProjection, ViewMode } from './types';

export function createExploreProjection(
  graph: ClusterGraph,
  view: ViewMode,
  filters: ExploreFilters,
): SceneProjection {
  const query = filters.query.trim().toLowerCase();
  const entityStates = Object.fromEntries(
    graph.snapshot.entities.map((entity) => {
      const matches =
        (!query || `${entity.kind} ${entity.name}`.toLowerCase().includes(query)) &&
        (!filters.kind || entity.kind === filters.kind) &&
        (!filters.namespace || entity.namespace === filters.namespace) &&
        (!filters.status || entity.status === filters.status);
      return [
        entity.id,
        {
          visible: matches,
          emphasis: matches ? 'normal' : 'hidden',
          labelMode: matches ? 'short' : 'none',
        } satisfies EntityProjection,
      ];
    }),
  ) as Record<EntityId, EntityProjection>;
  const relationStates = Object.fromEntries(
    graph.snapshot.relations.map((relation) => [
      relation.id,
      {
        visible: Boolean(
          entityStates[relation.from]?.visible && entityStates[relation.to]?.visible,
        ),
        emphasis: 'normal' as const,
      },
    ]),
  ) as Record<RelationId, { visible: boolean; emphasis: 'normal' }>;
  return { view, entityStates, relationStates, callouts: [], cameraPresetId: view };
}
