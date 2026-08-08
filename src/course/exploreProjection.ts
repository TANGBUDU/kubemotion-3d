import type { ExploreFilters } from '../state/appStore';
import type { EntityId, RelationId, WorldSnapshot } from '../world/types';
import type { EntityViewState, RelationViewState, ViewMode, ViewProjection } from './types';
import { createEffectiveScenePlan } from '../renderer/scene-grammar';

function isDirectMatch(
  world: WorldSnapshot,
  id: EntityId,
  filters: ExploreFilters,
  query: string,
): boolean {
  const entity = world.entities[id];
  if (!entity) return false;
  return (
    (!query || `${entity.kind} ${entity.name}`.toLowerCase().includes(query)) &&
    (!filters.kind || entity.kind === filters.kind) &&
    (!filters.namespace || entity.namespace === filters.namespace) &&
    (!filters.status || entity.status === filters.status)
  );
}

export function createExploreProjection(
  world: WorldSnapshot,
  view: ViewMode,
  filters: ExploreFilters,
): ViewProjection {
  const query = filters.query.trim().toLowerCase();
  const filtering = Boolean(query || filters.kind || filters.namespace || filters.status);
  const matches = new Set<EntityId>();
  if (filtering) {
    for (const id of Object.keys(world.entities)) {
      if (isDirectMatch(world, id, filters, query)) matches.add(id);
    }
  }

  const context = new Set<EntityId>(matches);
  if (filtering) {
    for (const relation of Object.values(world.relations)) {
      if (matches.has(relation.from) || matches.has(relation.to)) {
        context.add(relation.from);
        context.add(relation.to);
      }
    }
    for (const id of matches) {
      const entity = world.entities[id];
      const nodeName = entity?.data.nodeName;
      if (typeof nodeName === 'string') {
        const node = Object.values(world.entities).find(
          (candidate) => candidate.kind === 'Node' && candidate.name === nodeName,
        );
        if (node) context.add(node.id);
      }
    }
  }

  const entityStates = Object.fromEntries(
    Object.values(world.entities).map((entity) => {
      const matched = matches.has(entity.id);
      const visible = !filtering || context.has(entity.id);
      const state: EntityViewState = {
        visible,
        emphasis: !visible
          ? 'hidden'
          : filtering && !matched
            ? 'dimmed'
            : matched
              ? 'focused'
              : 'normal',
        labelMode: !visible ? 'none' : matched ? 'full' : 'short',
      };
      return [entity.id, state];
    }),
  ) as Record<EntityId, EntityViewState>;

  const relationStates = Object.fromEntries(
    Object.values(world.relations).map((relation) => {
      const visible = Boolean(
        entityStates[relation.from]?.visible && entityStates[relation.to]?.visible,
      );
      const state: RelationViewState = {
        visible,
        emphasis:
          visible && (matches.has(relation.from) || matches.has(relation.to))
            ? 'focused'
            : filtering
              ? 'dimmed'
              : 'normal',
      };
      return [relation.id, state];
    }),
  ) as Record<RelationId, RelationViewState>;

  const authoredProjection: ViewProjection = {
    view,
    entityStates,
    relationStates,
    callouts: [],
    activeRoutes: [],
    cameraPresetId: view,
  };
  return createEffectiveScenePlan(world, authoredProjection, {
    viewport: 'desktop',
    applyGrammarDefaults: !filtering,
    allowFocusedKindOverride: filtering,
  }).projection;
}
