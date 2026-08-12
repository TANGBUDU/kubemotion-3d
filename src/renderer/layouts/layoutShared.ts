import type { ViewProjection } from '../../course/types';
import type {
  EntityId,
  RelationId,
  RelationSemantic,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../world/types';
import type {
  EntityLayout,
  LayoutContainer,
  LayoutInput,
  LayoutResult,
  Position,
  RelationRoute,
} from '../LayoutEngine';
import { LayoutContractError, unassignedIssue } from './LayoutContractError';

export const byEntityId = (left: WorldEntity, right: WorldEntity): number =>
  left.id.localeCompare(right.id);

export const visibleEntities = (input: LayoutInput): readonly WorldEntity[] =>
  Object.values(input.world.entities)
    .filter((entity) => {
      const state = input.view.entityStates[entity.id];
      return state?.visible === true && state.emphasis !== 'hidden';
    })
    .sort(byEntityId);

export const toPositions = (
  entities: ReadonlyMap<EntityId, EntityLayout>,
): ReadonlyMap<EntityId, Position> =>
  new Map([...entities].map(([entityId, layout]) => [entityId, layout.position] as const));

const routeCurve = (semantic: RelationSemantic): RelationRoute['curve'] => {
  switch (semantic) {
    case 'ownership':
    case 'control-observation':
    case 'selection':
    case 'endpoint-membership':
      return 'arc';
    case 'placement':
    case 'storage':
    case 'configuration':
      return 'orthogonal';
    case 'composition':
    case 'scope':
    case 'data-flow':
    case 'DNS-flow':
      return 'straight';
  }
};

const anchorPosition = (
  layout: EntityLayout,
  relation: WorldRelation,
  endpoint: 'from' | 'to',
): Position => {
  const [x, y, z] = layout.position;
  if (relation.semantic === 'composition') {
    return endpoint === 'from' ? [x, y + 0.75, z] : [x, y + 0.88, z];
  }
  if (relation.semantic === 'placement') {
    return endpoint === 'from' ? [x, y + 0.45, z] : [x, y + 0.42, z];
  }
  if (relation.semantic === 'ownership') {
    return endpoint === 'from' ? [x + 0.9, y + 0.72, z] : [x - 0.72, y + 0.78, z];
  }
  if (relation.semantic === 'control-observation') {
    return [x, y + 0.72, z];
  }
  return [x, y + 0.5, z];
};

const buildRoutes = (
  world: WorldSnapshot,
  view: ViewProjection,
  entities: ReadonlyMap<EntityId, EntityLayout>,
): ReadonlyMap<RelationId, RelationRoute> => {
  const routes = new Map<RelationId, RelationRoute>();
  const relations = Object.values(world.relations).sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const relation of relations) {
    const state = view.relationStates[relation.id];
    if (!state?.visible) continue;
    const from = entities.get(relation.from);
    const to = entities.get(relation.to);
    if (!from || !to) continue;
    routes.set(relation.id, {
      relationId: relation.id,
      points: [anchorPosition(from, relation, 'from'), anchorPosition(to, relation, 'to')],
      curve: routeCurve(relation.semantic),
    });
  }
  return routes;
};

export const completeLayoutResult = (
  input: LayoutInput,
  entities: ReadonlyMap<EntityId, EntityLayout>,
  containers: readonly LayoutContainer[],
): LayoutResult => ({
  entities,
  containers,
  routes: buildRoutes(input.world, input.view, entities),
  positions: toPositions(entities),
});

export const assertEveryVisibleEntityIsAssigned = (
  input: LayoutInput,
  visible: readonly WorldEntity[],
  layouts: ReadonlyMap<EntityId, EntityLayout>,
): void => {
  const unassigned = visible.filter((entity) => !layouts.has(entity.id));
  if (unassigned.length === 0) return;
  throw new LayoutContractError({
    view: input.view.view,
    scenarioId: input.world.scenarioId,
    issues: [unassignedIssue(unassigned)],
  });
};

export const uniqueRole = (
  input: LayoutInput,
  role: string,
  candidates: readonly WorldEntity[],
  expectedKinds: readonly string[],
): WorldEntity => {
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length === 0) {
    throw new LayoutContractError({
      view: input.view.view,
      scenarioId: input.world.scenarioId,
      issues: [{ code: 'missing-role', role, expectedKinds }],
    });
  }
  throw new LayoutContractError({
    view: input.view.view,
    scenarioId: input.world.scenarioId,
    issues: [
      {
        code: 'ambiguous-role',
        role,
        entityIds: candidates.map((candidate) => candidate.id),
      },
    ],
  });
};

export const dataString = (entity: WorldEntity, key: string): string | undefined => {
  const value = entity.data[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const entityIdsFromEndpointSlice = (endpointSlice: WorldEntity): readonly EntityId[] => {
  const endpoints = endpointSlice.data.endpoints;
  if (!Array.isArray(endpoints)) return [];
  const ids: EntityId[] = [];
  for (const endpoint of endpoints) {
    if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) continue;
    const targetRef = (endpoint as Readonly<Record<string, unknown>>).targetRef;
    if (typeof targetRef === 'string' && targetRef.length > 0) ids.push(targetRef);
  }
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
};

export const compositionParent = (
  world: WorldSnapshot,
  childId: EntityId,
  layouts: ReadonlyMap<EntityId, EntityLayout>,
): EntityId | undefined =>
  Object.values(world.relations)
    .filter((relation) => relation.semantic === 'composition' && relation.to === childId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((relation) => relation.from)
    .find((parentId) => layouts.has(parentId));
