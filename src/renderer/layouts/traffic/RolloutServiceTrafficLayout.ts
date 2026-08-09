import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId, dataString } from '../layoutShared';
import {
  activeRouteSources,
  addLane,
  backendEntities,
  finishTrafficLayout,
  matchesServiceSelector,
  placeComposedContainers,
  trafficRole,
  uniqueEntities,
  type TrafficLayoutContext,
} from './trafficShared';

const CLIENT_X = -6.8;
const SERVICE_X = -0.8;
const BACKEND_CENTER_X = 5.5;
const MAIN_Z = 0.45;
const BACKEND_SPACING = 2.55;

const versionToken = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return value.match(/(?:^|[-_:])(old|new|v\d+(?:[.-]\d+)*)(?:$|[-_:])/i)?.[1]?.toLowerCase();
};

const directGeneration = (entity: WorldEntity): string | undefined =>
  entity.labels?.['app.kubernetes.io/version'] ??
  dataString(entity, 'version') ??
  versionToken(entity.visual.group) ??
  versionToken(entity.name) ??
  versionToken(entity.id);

const backendGeneration = (context: TrafficLayoutContext, backend: WorldEntity): string => {
  const direct = directGeneration(backend);
  if (direct) return direct;

  const owningReplicaSet = Object.values(context.input.world.relations)
    .filter((relation) => relation.semantic === 'ownership' && relation.to === backend.id)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((relation) => context.input.world.entities[relation.from])
    .find((entity) => entity?.kind === 'ReplicaSet');
  return (owningReplicaSet && directGeneration(owningReplicaSet)) || 'current';
};

const generationRank = (generation: string): number => {
  if (generation === 'old') return Number.NEGATIVE_INFINITY;
  if (generation === 'new') return Number.POSITIVE_INFINITY;
  const numeric = generation.match(/^v(\d+)/i)?.[1];
  return numeric ? Number(numeric) : 0;
};

const byGeneration = (left: string, right: string): number =>
  generationRank(left) - generationRank(right) ||
  left.localeCompare(right, undefined, { numeric: true });

const backendPosition = (index: number, count: number, z: number) =>
  [BACKEND_CENTER_X + (index - (count - 1) / 2) * BACKEND_SPACING, 0.18, z] as const;

/** Stable old/new backend rows for rolling updates and expanded-capacity traffic beats. */
export class RolloutServiceTrafficLayout {
  public calculate(
    context: TrafficLayoutContext,
    service: WorldEntity,
    endpointSlice: WorldEntity,
  ): LayoutResult {
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const routeSources = activeRouteSources(context);
    const clients = uniqueEntities([
      ...context.visible.filter((entity) => trafficRole(entity) === 'client'),
      ...routeSources.filter(
        (entity) =>
          entity.id !== service.id &&
          entity.id !== endpointSlice.id &&
          entity.kind !== 'PublicDNS' &&
          entity.kind !== 'GatewayDataPlane',
      ),
    ]).sort(byEntityId);
    const clientIds = new Set(clients.map((entity) => entity.id));
    const backends = uniqueEntities([
      ...backendEntities(context, endpointSlice, service),
      // A new generation must remain visible while NotReady even before EndpointSlice admits it.
      ...context.visible.filter(
        (entity) =>
          entity.kind === 'Pod' &&
          directGeneration(entity) !== undefined &&
          matchesServiceSelector(entity, service) &&
          !clientIds.has(entity.id),
      ),
    ]).sort(byEntityId);

    if (clients.length === 0 && context.input.view.activeRoutes.length > 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'rollout-client', expectedKinds: ['Pod'] }],
      });
    }
    if (backends.length === 0 && context.input.view.activeRoutes.length > 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'rollout-backend', expectedKinds: ['Pod'] }],
      });
    }

    const groupedBackends = new Map<string, WorldEntity[]>();
    for (const backend of backends) {
      const generation = backendGeneration(context, backend);
      const group = groupedBackends.get(generation) ?? [];
      group.push(backend);
      groupedBackends.set(generation, group);
    }
    const generations = [...groupedBackends.keys()].sort(byGeneration);
    const oldGeneration = generations[0];
    const oldBackends = oldGeneration
      ? [...(groupedBackends.get(oldGeneration) ?? [])].sort(byEntityId)
      : [];
    const newerBackends = generations
      .slice(1)
      .flatMap((generation) => groupedBackends.get(generation) ?? [])
      .sort((left, right) => {
        const generationOrder = byGeneration(
          backendGeneration(context, left),
          backendGeneration(context, right),
        );
        return generationOrder || byEntityId(left, right);
      });
    const hasMultipleGenerations = newerBackends.length > 0;
    const singleGenerationBackends = hasMultipleGenerations ? [] : oldBackends;

    addLane(layouts, containers, {
      id: 'rollout-traffic-client',
      label: 'CLIENT',
      entities: clients,
      position: (_entity, index, count) => [
        CLIENT_X,
        0.18,
        MAIN_Z + (index - (count - 1) / 2) * 2.25,
      ],
      bounds: {
        center: [CLIENT_X, 0.025, MAIN_Z],
        size: [2.9, 0.05, Math.max(2.7, clients.length * 2.25 + 0.4)],
      },
      labelAnchor: [CLIENT_X - 1.35, 0.1, MAIN_Z - 1.15],
    });
    addLane(layouts, containers, {
      id: 'rollout-traffic-service',
      label: 'SERVICE',
      entities: [service],
      position: () => [SERVICE_X, 0.18, MAIN_Z],
      bounds: { center: [SERVICE_X, 0.025, MAIN_Z], size: [3.2, 0.05, 2.75] },
      labelAnchor: [SERVICE_X - 1.45, 0.1, MAIN_Z - 1.18],
    });

    addLane(layouts, containers, {
      id: 'rollout-traffic-backends',
      label: 'BACKENDS',
      entities: singleGenerationBackends,
      position: (_entity, index, count) => backendPosition(index, count, MAIN_Z),
      bounds: {
        center: [BACKEND_CENTER_X, 0.025, MAIN_Z],
        size: [Math.max(3.8, singleGenerationBackends.length * BACKEND_SPACING + 0.6), 0.05, 2.75],
      },
      labelAnchor: [
        BACKEND_CENTER_X -
          Math.max(3.8, singleGenerationBackends.length * BACKEND_SPACING + 0.6) / 2 +
          0.2,
        0.1,
        MAIN_Z - 1.18,
      ],
    });
    addLane(layouts, containers, {
      id: 'rollout-traffic-old-backends',
      label: oldGeneration ? `OLD / ${oldGeneration.toUpperCase()}` : 'OLD BACKENDS',
      entities: hasMultipleGenerations ? oldBackends : [],
      position: (_entity, index, count) => backendPosition(index, count, -0.35),
      bounds: {
        center: [BACKEND_CENTER_X, 0.025, -0.35],
        size: [Math.max(3.8, oldBackends.length * BACKEND_SPACING + 0.6), 0.05, 2.0],
      },
      labelAnchor: [
        BACKEND_CENTER_X - Math.max(3.8, oldBackends.length * BACKEND_SPACING + 0.6) / 2 + 0.2,
        0.1,
        -1.15,
      ],
    });
    addLane(layouts, containers, {
      id: 'rollout-traffic-new-backends',
      label: `NEW / ${(generations.at(-1) ?? 'NEXT').toUpperCase()}`,
      entities: newerBackends,
      position: (_entity, index, count) => backendPosition(index, count, 2.0),
      bounds: {
        center: [BACKEND_CENTER_X, 0.025, 2.0],
        size: [Math.max(3.8, newerBackends.length * BACKEND_SPACING + 0.6), 0.05, 2.0],
      },
      labelAnchor: [
        BACKEND_CENTER_X - Math.max(3.8, newerBackends.length * BACKEND_SPACING + 0.6) / 2 + 0.2,
        0.1,
        1.2,
      ],
    });

    addLane(layouts, containers, {
      id: 'rollout-traffic-endpoint-state',
      label: 'ENDPOINT STATE',
      entities: [endpointSlice],
      position: () => [2.25, 0.18, 4.25],
      bounds: { center: [2.25, 0.025, 4.25], size: [5.3, 0.05, 2.25] },
    });

    const workloadSupport = context.visible
      .filter((entity) =>
        ['Deployment', 'ReplicaSet', 'HorizontalPodAutoscaler', 'MetricSource'].includes(
          entity.kind,
        ),
      )
      .sort((left, right) => {
        const kindPriority = [
          'Deployment',
          'ReplicaSet',
          'HorizontalPodAutoscaler',
          'MetricSource',
        ];
        return (
          kindPriority.indexOf(left.kind) - kindPriority.indexOf(right.kind) ||
          byEntityId(left, right)
        );
      });
    addLane(layouts, containers, {
      id: 'rollout-traffic-workload-support',
      label: 'ROLLOUT SUPPORT',
      kind: 'workload-lane',
      lane: 'workload-state',
      entities: workloadSupport,
      position: (_entity, index, count) => [2.35 + (index - (count - 1) / 2) * 3.25, 0.18, -4.35],
      bounds: {
        center: [2.35, 0.025, -4.35],
        size: [Math.max(3.6, workloadSupport.length * 3.25 + 0.4), 0.05, 2.2],
      },
    });

    placeComposedContainers(context, layouts);
    return finishTrafficLayout(context, layouts, containers);
  }
}
