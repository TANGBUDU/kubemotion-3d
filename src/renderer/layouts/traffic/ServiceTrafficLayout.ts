import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult, Position } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId } from '../layoutShared';
import {
  activeRouteSources,
  addLane,
  backendEntities,
  finishTrafficLayout,
  placeComposedContainers,
  placeScopeContext,
  trafficRole,
  uniqueEntities,
  type TrafficLayoutContext,
} from './trafficShared';

/** The canonical source -> Service -> selected backend teaching projection. */
export class ServiceTrafficLayout {
  public calculate(
    context: TrafficLayoutContext,
    service: WorldEntity,
    endpointSlice: WorldEntity,
  ): LayoutResult {
    const clients = uniqueEntities([
      ...context.visible.filter((entity) => trafficRole(entity) === 'client'),
      ...activeRouteSources(context).filter(
        (entity) =>
          entity.id !== service.id &&
          entity.id !== endpointSlice.id &&
          entity.kind !== 'PublicDNS' &&
          entity.kind !== 'GatewayDataPlane',
      ),
    ]).sort(byEntityId);
    if (clients.length === 0 && context.input.view.activeRoutes.length > 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'traffic-client' }],
      });
    }

    const backends = backendEntities(context, endpointSlice, service);
    if (backends.length === 0 && context.input.view.activeRoutes.length > 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'ready-backend', expectedKinds: ['Pod'] }],
      });
    }

    const publicDns = context.visible.find((entity) => entity.kind === 'PublicDNS');
    const gatewayDataPlane = context.visible.find((entity) => entity.kind === 'GatewayDataPlane');
    const gatewayConfiguration = context.visible
      .filter((entity) => entity.kind === 'Gateway' || entity.kind === 'HTTPRoute')
      .sort(byEntityId);
    const externalTraffic = publicDns !== undefined || gatewayDataPlane !== undefined;
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];

    const clientX = externalTraffic ? -8.6 : -7.4;
    const serviceX = externalTraffic ? 0.25 : -1.85;
    const backendX = externalTraffic ? 6.2 : 4.85;
    const servicePosition: Position = [serviceX, 0.18, 0.65];
    const endpointSlicePosition: Position = [serviceX + 0.35, 0.18, -2.25];

    addLane(layouts, containers, {
      id: 'traffic-client-lane',
      label: 'CLIENT',
      entities: clients,
      position: (_entity, index, count) => [clientX, 0.18, (index - (count - 1) / 2) * 2.3],
      bounds: { center: [clientX, 0.025, 0], size: [2.8, 0.05, 7.2] },
      labelAnchor: [clientX - 1.35, 0.1, -3.2],
    });
    addLane(layouts, containers, {
      id: 'traffic-dns-support',
      label: 'DNS SUPPORT',
      entities: publicDns ? [publicDns] : [],
      position: () => [-5.9, 0.18, -2.35],
      bounds: { center: [-5.9, 0.025, -2.35], size: [3.1, 0.05, 2.25] },
      labelAnchor: [-7.35, 0.1, -3.45],
    });
    addLane(layouts, containers, {
      id: 'traffic-ingress-data-plane',
      label: 'GATEWAY DATA PLANE',
      entities: gatewayDataPlane ? [gatewayDataPlane] : [],
      position: () => [-4.3, 0.18, 0.65],
      bounds: { center: [-4.3, 0.025, 0.65], size: [3.5, 0.05, 2.65] },
      labelAnchor: [-5.85, 0.1, -0.75],
    });

    addLane(layouts, containers, {
      id: 'traffic-service-context',
      label: 'STABLE ENTRY / ENDPOINT STATE',
      entities: [service, endpointSlice],
      position: (entity) => (entity.id === service.id ? servicePosition : endpointSlicePosition),
      bounds: { center: [serviceX, 0.025, -0.7], size: [4.7, 0.05, 6.3] },
      labelAnchor: [serviceX - 2.35, 0.1, -3.25],
    });
    addLane(layouts, containers, {
      id: 'traffic-backend-lane',
      label: 'BACKEND PODS',
      entities: backends,
      position: (_entity, index, count) => [backendX, 0.18, (index - (count - 1) / 2) * 2.6],
      bounds: { center: [backendX, 0.025, 0], size: [4.1, 0.05, 7.2] },
      labelAnchor: [backendX - 2.0, 0.1, -3.25],
    });
    addLane(layouts, containers, {
      id: 'traffic-routing-configuration',
      label: 'ROUTING CONFIGURATION (SUPPORT)',
      entities: gatewayConfiguration,
      position: (_entity, index) => [-2.9 + index * 3.2, 0.18, 3.55],
      bounds: { center: [-1.3, 0.025, 3.55], size: [7.2, 0.05, 2.55] },
      labelAnchor: [-4.6, 0.1, 2.25],
    });

    const workloadSupport = context.visible
      .filter((entity) =>
        ['Deployment', 'ReplicaSet', 'HorizontalPodAutoscaler', 'MetricSource'].includes(
          entity.kind,
        ),
      )
      .sort(byEntityId);
    addLane(layouts, containers, {
      id: 'traffic-workload-support',
      label: 'WORKLOAD SUPPORT',
      kind: 'workload-lane',
      lane: 'workload-state',
      entities: workloadSupport,
      position: (_entity, index, count) => [0.2 + (index - (count - 1) / 2) * 3.0, 0.18, 4.95],
      bounds: {
        center: [0.2, 0.025, 4.95],
        size: [Math.max(4, workloadSupport.length * 3.0), 0.05, 2.3],
      },
    });

    const nodeContext = context.visible.filter((entity) => entity.kind === 'Node').sort(byEntityId);
    addLane(layouts, containers, {
      id: 'traffic-placement-context',
      label: 'PLACEMENT CONTEXT',
      entities: nodeContext,
      lane: 'node',
      position: (_entity, index, count) => [backendX + (index - (count - 1) / 2) * 3.3, 0, 4.65],
      bounds: {
        center: [backendX, 0.025, 4.65],
        size: [Math.max(4, nodeContext.length * 3.3), 0.05, 2.4],
      },
    });

    placeScopeContext(context, layouts, 'traffic-scope-context', [7.9, 0.04, 4.85]);
    placeComposedContainers(context, layouts);
    return finishTrafficLayout(context, layouts, containers);
  }
}
