import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult, Position } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId, entityIdsFromEndpointSlice } from '../layoutShared';
import { addLane, finishTrafficLayout, type TrafficLayoutContext } from './trafficShared';

const DNS_MAIN_Z = 0.4;
// Foreground support projects below the main route for the authored Traffic camera.
const DNS_ENDPOINT_Z = 3.2;

const focusedInProjection = (context: TrafficLayoutContext, entity: WorldEntity): boolean =>
  context.input.view.entityStates[entity.id]?.emphasis === 'focused';

const endpointSliceBelongsToRoute = (
  endpointSlice: WorldEntity,
  routeServices: readonly WorldEntity[],
  physicalRouteIds: ReadonlySet<EntityId>,
): boolean => {
  const serviceName = endpointSlice.data.serviceName;
  const serviceLabel = endpointSlice.labels?.['kubernetes.io/service-name'];
  const matchesService = routeServices.some(
    (service) =>
      (serviceName === service.name || serviceLabel === service.name) &&
      (!endpointSlice.namespace ||
        !service.namespace ||
        endpointSlice.namespace === service.namespace),
  );
  const referencesRouteBackend = entityIdsFromEndpointSlice(endpointSlice).some((id) =>
    physicalRouteIds.has(id),
  );
  return matchesService || referencesRouteBackend;
};

/** A DNS query/response corridor whose physical hops are authored by the active DNS route. */
export class DnsOnlyTrafficLayout {
  public calculate(context: TrafficLayoutContext): LayoutResult {
    const orderedIds: EntityId[] = [];
    for (const route of context.input.view.activeRoutes.filter(
      (candidate) => candidate.semantic === 'dns',
    )) {
      for (const hop of route.hops) {
        if (!orderedIds.includes(hop.fromEntityId)) orderedIds.push(hop.fromEntityId);
        if (!orderedIds.includes(hop.toEntityId)) orderedIds.push(hop.toEntityId);
      }
    }

    const ordered = orderedIds
      .map((id) => context.visibleById.get(id))
      .filter((entity): entity is WorldEntity => entity !== undefined);
    if (ordered.length < 2 || ordered.length !== orderedIds.length) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'dns-route-endpoints' }],
      });
    }

    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const spacing = ordered.length > 1 ? Math.min(6, 12 / (ordered.length - 1)) : 6;
    const routePosition = (index: number, count: number): Position => [
      (index - (count - 1) / 2) * spacing,
      0.18,
      DNS_MAIN_Z,
    ];

    addLane(layouts, containers, {
      id: 'dns-route-lane',
      label: 'DNS QUERY / RESPONSE',
      entities: ordered,
      position: (_entity, index, count) => routePosition(index, count),
      bounds: {
        center: [0, 0.025, DNS_MAIN_Z],
        size: [Math.max(7, (ordered.length - 1) * spacing + 3.2), 0.05, 2.8],
      },
      labelAnchor: [-(ordered.length - 1) * spacing * 0.5 - 1.4, 0.1, DNS_MAIN_Z - 1.25],
    });

    const physicalRouteIds = new Set(orderedIds);
    const routeServices = ordered.filter((entity) => entity.kind === 'Service');
    const endpointState = context.visible
      .filter(
        (entity) =>
          entity.kind === 'EndpointSlice' &&
          !physicalRouteIds.has(entity.id) &&
          endpointSliceBelongsToRoute(entity, routeServices, physicalRouteIds),
      )
      .sort(byEntityId);
    const serviceIndex = ordered.findIndex((entity) => entity.kind === 'Service');
    const endpointCenterX =
      serviceIndex >= 0
        ? (routePosition(serviceIndex, ordered.length)[0] +
            routePosition(ordered.length - 1, ordered.length)[0]) /
          2
        : 0;
    addLane(layouts, containers, {
      id: 'dns-endpoint-state',
      label: 'DNS ENDPOINT STATE',
      entities: endpointState,
      position: (_entity, index, count) => [
        endpointCenterX + (index - (count - 1) / 2) * 3.2,
        0.18,
        DNS_ENDPOINT_Z,
      ],
      bounds: {
        center: [endpointCenterX, 0.025, DNS_ENDPOINT_Z],
        size: [Math.max(4, endpointState.length * 3.2), 0.05, 2.25],
      },
      labelAnchor: [
        endpointCenterX - Math.max(4, endpointState.length * 3.2) / 2,
        0.1,
        DNS_ENDPOINT_Z - 1.05,
      ],
    });

    // A public-DNS beat may retain the already-resolved listener as subdued context. It remains
    // outside the physical query route and is not mixed with in-cluster EndpointSlice evidence.
    const externalSupport = ordered.some((entity) => entity.kind === 'PublicDNS')
      ? context.visible
          .filter(
            (entity) =>
              !layouts.has(entity.id) &&
              ['GatewayDataPlane', 'Gateway', 'HTTPRoute'].includes(entity.kind),
          )
          .sort(byEntityId)
      : [];
    addLane(layouts, containers, {
      id: 'dns-support-context',
      label: 'RESOLVED APPLICATION ENTRY',
      entities: externalSupport,
      position: (_entity, index, count) => [4.8 + (index - (count - 1) / 2) * 3.2, 0.18, 3.35],
      bounds: {
        center: [4.8, 0.025, 3.35],
        size: [Math.max(4, externalSupport.length * 3.2), 0.05, 2.25],
      },
    });

    // A non-route Service/EndpointSlice is deliberately not introduced as a packet hop. Only an
    // explicitly focused evidence object may be retained, and it stays off the query corridor.
    const focusedEvidence = context.visible
      .filter(
        (entity) =>
          !layouts.has(entity.id) &&
          (entity.kind === 'Service' || entity.kind === 'EndpointSlice') &&
          focusedInProjection(context, entity),
      )
      .sort(byEntityId);
    addLane(layouts, containers, {
      id: 'dns-focused-evidence',
      label: 'FOCUSED DNS EVIDENCE',
      entities: focusedEvidence,
      position: (_entity, index, count) => [(index - (count - 1) / 2) * 3.2, 0.18, 3.35],
      bounds: {
        center: [0, 0.025, 3.35],
        size: [Math.max(4, focusedEvidence.length * 3.2), 0.05, 2.25],
      },
    });

    return finishTrafficLayout(context, layouts, containers);
  }
}
