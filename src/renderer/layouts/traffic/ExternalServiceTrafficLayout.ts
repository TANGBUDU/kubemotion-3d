import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId } from '../layoutShared';
import {
  activeRouteSources,
  addLane,
  backendEntities,
  finishTrafficLayout,
  placeComposedContainers,
  trafficRole,
  uniqueEntities,
  type TrafficLayoutContext,
} from './trafficShared';

const MAIN_Z = 0.5;
const BROWSER_X = -8.2;
const GATEWAY_DATA_PLANE_X = -4.2;
const SERVICE_X = 0.2;
const BACKEND_X = 5.8;

const requireExternalRole = (
  context: TrafficLayoutContext,
  role: string,
  candidates: readonly WorldEntity[],
  expectedKinds: readonly string[],
): WorldEntity => {
  if (candidates.length === 1) return candidates[0]!;
  throw new LayoutContractError({
    view: context.input.view.view,
    scenarioId: context.input.world.scenarioId,
    issues: [
      candidates.length === 0
        ? { code: 'missing-role', role, expectedKinds }
        : { code: 'ambiguous-role', role, entityIds: candidates.map((entity) => entity.id) },
    ],
  });
};

/** Browser -> Gateway data plane -> Service -> selected backend application traffic. */
export class ExternalServiceTrafficLayout {
  public calculate(
    context: TrafficLayoutContext,
    service: WorldEntity,
    endpointSlice: WorldEntity,
  ): LayoutResult {
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const clients = uniqueEntities([
      ...context.visible.filter(
        (entity) =>
          entity.kind === 'Browser' ||
          entity.kind === 'ExternalClient' ||
          trafficRole(entity) === 'client',
      ),
      ...activeRouteSources(context).filter(
        (entity) => entity.kind === 'Browser' || entity.kind === 'ExternalClient',
      ),
    ]).sort(byEntityId);
    const gateways = context.visible
      .filter((entity) => entity.kind === 'GatewayDataPlane')
      .sort(byEntityId);
    const browser = requireExternalRole(context, 'external-client', clients, [
      'Browser',
      'ExternalClient',
    ]);
    const gatewayDataPlane = requireExternalRole(context, 'gateway-data-plane', gateways, [
      'GatewayDataPlane',
    ]);
    const backends = backendEntities(context, endpointSlice, service);
    if (backends.length === 0 && context.input.view.activeRoutes.length > 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'external-backend', expectedKinds: ['Pod'] }],
      });
    }

    const publicDns = context.visible
      .filter((entity) => entity.kind === 'PublicDNS')
      .sort(byEntityId);
    const routingConfiguration = context.visible
      .filter(
        (entity) =>
          entity.kind === 'Gateway' ||
          entity.kind === 'HTTPRoute' ||
          entity.kind === 'GatewayClass',
      )
      .sort(byEntityId);

    addLane(layouts, containers, {
      id: 'external-traffic-client',
      label: 'CLIENT',
      entities: [browser],
      position: () => [BROWSER_X, 0.18, MAIN_Z],
      bounds: { center: [BROWSER_X, 0.025, MAIN_Z], size: [2.75, 0.05, 2.7] },
      labelAnchor: [BROWSER_X - 1.25, 0.1, MAIN_Z - 1.15],
    });
    addLane(layouts, containers, {
      id: 'external-traffic-gateway-data-plane',
      label: 'GATEWAY DATA PLANE',
      entities: [gatewayDataPlane],
      position: () => [GATEWAY_DATA_PLANE_X, 0.18, MAIN_Z],
      bounds: {
        center: [GATEWAY_DATA_PLANE_X, 0.025, MAIN_Z],
        size: [3.05, 0.05, 2.7],
      },
      labelAnchor: [GATEWAY_DATA_PLANE_X - 1.4, 0.1, MAIN_Z - 1.15],
    });
    addLane(layouts, containers, {
      id: 'external-traffic-service',
      label: 'SERVICE',
      entities: [service],
      position: () => [SERVICE_X, 0.18, MAIN_Z],
      bounds: { center: [SERVICE_X, 0.025, MAIN_Z], size: [3.05, 0.05, 2.7] },
      labelAnchor: [SERVICE_X - 1.4, 0.1, MAIN_Z - 1.15],
    });
    addLane(layouts, containers, {
      id: 'external-traffic-backends',
      label: 'BACKENDS',
      entities: backends,
      position: (_entity, index, count) => [
        BACKEND_X,
        0.18,
        MAIN_Z + (index - (count - 1) / 2) * 2.45,
      ],
      bounds: {
        center: [BACKEND_X, 0.025, MAIN_Z],
        size: [3.9, 0.05, Math.max(2.7, backends.length * 2.45 + 0.5)],
      },
      labelAnchor: [
        BACKEND_X - 1.8,
        0.1,
        MAIN_Z - Math.max(2.7, backends.length * 2.45 + 0.5) / 2 + 0.2,
      ],
    });

    // These objects explain the request without becoming physical route participants. Omitting a
    // label anchor keeps the four main corridor headings visually dominant.
    addLane(layouts, containers, {
      id: 'external-traffic-resolved-address',
      label: 'RESOLVED ADDRESS',
      entities: publicDns,
      position: (_entity, index, count) => [-8.0, 0.18, -3.2 + (index - (count - 1) / 2) * 2.25],
      bounds: {
        center: [-8.0, 0.025, -3.2],
        size: [2.8, 0.05, Math.max(2.2, publicDns.length * 2.25 + 0.35)],
      },
    });
    addLane(layouts, containers, {
      id: 'external-traffic-routing-configuration',
      label: 'ROUTING CONFIGURATION',
      entities: routingConfiguration,
      position: (_entity, index, count) => [-2.2 + (index - (count - 1) / 2) * 3.25, 0.18, -3.25],
      bounds: {
        center: [-2.2, 0.025, -3.25],
        size: [Math.max(3.25, routingConfiguration.length * 3.25 + 0.45), 0.05, 2.25],
      },
    });
    addLane(layouts, containers, {
      id: 'external-traffic-endpoint-state',
      label: 'ENDPOINT STATE',
      entities: [endpointSlice],
      position: () => [2.9, 0.18, 3.55],
      bounds: { center: [2.9, 0.025, 3.55], size: [5.2, 0.05, 2.25] },
    });

    placeComposedContainers(context, layouts);
    return finishTrafficLayout(context, layouts, containers);
  }
}
