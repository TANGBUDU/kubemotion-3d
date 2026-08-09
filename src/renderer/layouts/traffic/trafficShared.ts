import type { ActiveTeachingRoute } from '../../../course/types';
import { isPlainRecord } from '../../../world/dataGuards';
import type { EntityId, WorldEntity } from '../../../world/types';
import type {
  EntityLayout,
  LayoutContainer,
  LayoutInput,
  LayoutResult,
  LayoutSlot,
  Position,
} from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import {
  assertEveryVisibleEntityIsAssigned,
  byEntityId,
  completeLayoutResult,
  compositionParent,
  dataString,
  entityIdsFromEndpointSlice,
  visibleEntities,
} from '../layoutShared';

export type TeachingRouteSupport = NonNullable<ActiveTeachingRoute['support']>;

export interface TrafficLayoutContext {
  readonly input: LayoutInput;
  readonly visible: readonly WorldEntity[];
  readonly visibleById: ReadonlyMap<EntityId, WorldEntity>;
  readonly routeEntityIds: ReadonlySet<EntityId>;
  readonly routeSupports: readonly TeachingRouteSupport[];
  readonly serviceCandidates: readonly WorldEntity[];
  readonly endpointSliceCandidates: readonly WorldEntity[];
}

export interface LaneOptions {
  readonly id: string;
  readonly label: string;
  readonly kind?: LayoutContainer['kind'];
  readonly entities: readonly WorldEntity[];
  readonly position: (entity: WorldEntity, index: number, count: number) => Position;
  readonly bounds: LayoutContainer['bounds'];
  readonly labelAnchor?: Position;
  readonly lane?: EntityLayout['lane'];
  readonly zoneId?: LayoutContainer['zoneId'];
}

export const trafficRole = (entity: WorldEntity): string | undefined =>
  dataString(entity, 'trafficRole');

/** True when a namespaced workload satisfies the Service's complete equality selector. */
export const matchesServiceSelector = (entity: WorldEntity, service: WorldEntity): boolean => {
  const selector = service.data.selector;
  if (!isPlainRecord(selector)) return false;
  if (service.namespace && entity.namespace !== service.namespace) return false;
  const entries = Object.entries(selector);
  return (
    entries.length > 0 &&
    entries.every(([key, value]) => typeof value === 'string' && entity.labels?.[key] === value)
  );
};

export const uniqueEntities = (entities: readonly WorldEntity[]): WorldEntity[] => {
  const seen = new Set<EntityId>();
  return entities.filter((entity) => {
    if (seen.has(entity.id)) return false;
    seen.add(entity.id);
    return true;
  });
};

const collectRouteEntityIds = (input: LayoutInput): ReadonlySet<EntityId> => {
  const ids = new Set<EntityId>();
  for (const route of input.view.activeRoutes) {
    for (const hop of route.hops) {
      ids.add(hop.fromEntityId);
      ids.add(hop.toEntityId);
    }
    if (route.support) {
      ids.add(route.support.serviceId);
      ids.add(route.support.endpointSliceId);
      ids.add(route.support.selectedEndpointTargetId);
    }
  }
  return ids;
};

export const buildTrafficContext = (input: LayoutInput): TrafficLayoutContext => {
  const visible = visibleEntities(input);
  const visibleById = new Map(visible.map((entity) => [entity.id, entity] as const));
  const routeSupports = input.view.activeRoutes
    .map((route) => route.support)
    .filter((support): support is TeachingRouteSupport => support !== undefined);

  const serviceIds = [...new Set(routeSupports.map((support) => support.serviceId))];
  const serviceCandidates =
    serviceIds.length > 0
      ? serviceIds
          .map((id) => visibleById.get(id))
          .filter((entity): entity is WorldEntity => entity !== undefined)
      : visible.filter((entity) => entity.kind === 'Service');

  const endpointSliceIds = [...new Set(routeSupports.map((support) => support.endpointSliceId))];
  const endpointSliceCandidates =
    endpointSliceIds.length > 0
      ? endpointSliceIds
          .map((id) => visibleById.get(id))
          .filter((entity): entity is WorldEntity => entity !== undefined)
      : visible.filter((entity) => entity.kind === 'EndpointSlice');

  return {
    input,
    visible,
    visibleById,
    routeEntityIds: collectRouteEntityIds(input),
    routeSupports,
    serviceCandidates,
    endpointSliceCandidates,
  };
};

export const addLane = (
  layouts: Map<EntityId, EntityLayout>,
  containers: LayoutContainer[],
  options: LaneOptions,
): void => {
  if (options.entities.length === 0) return;
  const slots: LayoutSlot[] = options.entities.map((entity, index) => {
    const position = options.position(entity, index, options.entities.length);
    layouts.set(entity.id, {
      entityId: entity.id,
      position,
      lane: options.lane ?? 'semantic',
      containerId: options.id,
      slotIndex: index,
    });
    return {
      id: `${options.id}:slot:${index}`,
      index,
      position,
      occupiedBy: entity.id,
    };
  });
  containers.push({
    id: options.id,
    kind: options.kind ?? 'semantic-lane',
    label: options.label,
    ...(options.zoneId ? { zoneId: options.zoneId } : {}),
    ...(options.labelAnchor ? { labelAnchor: options.labelAnchor } : {}),
    bounds: options.bounds,
    slots,
  });
};

export const placeScopeContext = (
  context: TrafficLayoutContext,
  layouts: Map<EntityId, EntityLayout>,
  containerId: string,
  basePosition: Position,
): void => {
  context.visible
    .filter((entity) => entity.kind === 'Cluster' || entity.kind === 'Namespace')
    .sort(byEntityId)
    .forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [basePosition[0], basePosition[1] + index * 0.03, basePosition[2]],
        lane: 'semantic',
        containerId,
        slotIndex: index,
      });
    });
};

export const placeComposedContainers = (
  context: TrafficLayoutContext,
  layouts: Map<EntityId, EntityLayout>,
): void => {
  const runtimeContainers = context.visible
    .filter((entity) => entity.kind === 'Container')
    .sort(byEntityId);
  for (const entity of runtimeContainers) {
    const parentId = compositionParent(context.input.world, entity.id, layouts);
    if (!parentId) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-parent', entityId: entity.id, expectedParentKind: 'Pod' }],
      });
    }
    layouts.set(entity.id, {
      entityId: entity.id,
      position: [0, 0, 0],
      lane: 'composition',
      parentId,
      containerId: `pod:${parentId}`,
    });
  }
};

export const finishTrafficLayout = (
  context: TrafficLayoutContext,
  layouts: ReadonlyMap<EntityId, EntityLayout>,
  containers: readonly LayoutContainer[],
): LayoutResult => {
  assertEveryVisibleEntityIsAssigned(context.input, context.visible, layouts);
  return completeLayoutResult(context.input, layouts, containers);
};

export const activeRouteSources = (context: TrafficLayoutContext): readonly WorldEntity[] =>
  context.input.view.activeRoutes
    .map((route) => route.hops[0]?.fromEntityId)
    .filter((id): id is EntityId => typeof id === 'string')
    .map((id) => context.visibleById.get(id))
    .filter((entity): entity is WorldEntity => entity !== undefined);

export const backendEntities = (
  context: TrafficLayoutContext,
  endpointSlice: WorldEntity,
  service: WorldEntity,
): readonly WorldEntity[] => {
  const endpointBackendIds = entityIdsFromEndpointSlice(endpointSlice);
  const selectedBackendIds = context.routeSupports.map(
    (support) => support.selectedEndpointTargetId,
  );
  const routeTargetIds = context.input.view.activeRoutes
    .map((route) => route.hops.at(-1)?.toEntityId)
    .filter((id): id is EntityId => typeof id === 'string');
  const ids = new Set<EntityId>([
    ...endpointBackendIds,
    ...selectedBackendIds,
    ...routeTargetIds,
    ...context.visible
      .filter((entity) => trafficRole(entity) === 'backend')
      .map((entity) => entity.id),
  ]);
  return context.visible
    .filter((entity) => ids.has(entity.id) && entity.id !== service.id)
    .sort(byEntityId);
};
