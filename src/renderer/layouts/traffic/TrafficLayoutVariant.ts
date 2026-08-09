import type { WorldEntity } from '../../../world/types';
import { dataString, entityIdsFromEndpointSlice } from '../layoutShared';
import { matchesServiceSelector, trafficRole, type TrafficLayoutContext } from './trafficShared';

export type TrafficLayoutVariant = 'internal-service' | 'external-service' | 'rollout-service';

const BACKEND_VERSION_LABEL = 'app.kubernetes.io/version';

const entityVersion = (entity: WorldEntity): string | undefined =>
  entity.labels?.[BACKEND_VERSION_LABEL] ?? dataString(entity, 'version');

const visibleRouteKinds = (context: TrafficLayoutContext): ReadonlySet<string> =>
  new Set(
    context.visible
      .filter((entity) => context.routeEntityIds.has(entity.id))
      .map((entity) => entity.kind),
  );

/**
 * Chooses a Service traffic composition from the projected topology and route participants.
 * Lesson IDs are intentionally absent so the same world shape always receives the same grammar.
 */
export const classifyServiceTraffic = (context: TrafficLayoutContext): TrafficLayoutVariant => {
  const routeKinds = visibleRouteKinds(context);
  const hasVisibleBrowser = context.visible.some((entity) => entity.kind === 'Browser');
  const hasVisibleGatewayDataPlane = context.visible.some(
    (entity) => entity.kind === 'GatewayDataPlane',
  );
  const routeIsExternal = routeKinds.has('Browser') || routeKinds.has('GatewayDataPlane');

  if (routeIsExternal || (hasVisibleBrowser && hasVisibleGatewayDataPlane)) {
    return 'external-service';
  }

  const replicaSets = context.visible.filter((entity) => entity.kind === 'ReplicaSet');
  if (replicaSets.length > 1) return 'rollout-service';

  const endpointBackendIds = new Set(
    context.endpointSliceCandidates.flatMap((endpointSlice) =>
      entityIdsFromEndpointSlice(endpointSlice),
    ),
  );
  const backendVersions = new Set(
    context.visible
      .filter(
        (entity) =>
          entity.kind === 'Pod' &&
          trafficRole(entity) !== 'client' &&
          (endpointBackendIds.has(entity.id) ||
            trafficRole(entity) === 'backend' ||
            context.serviceCandidates.some((service) => matchesServiceSelector(entity, service))),
      )
      .map(entityVersion)
      .filter((version): version is string => version !== undefined),
  );
  if (backendVersions.size > 1) return 'rollout-service';

  return 'internal-service';
};
