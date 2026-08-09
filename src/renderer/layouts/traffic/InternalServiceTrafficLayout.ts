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
  trafficRole,
  uniqueEntities,
  type TrafficLayoutContext,
} from './trafficShared';

const CLIENT_X = -5.0;
const SERVICE_X = -0.4;
const BACKEND_X = 4.4;
const MAIN_Z = 0.5;
const ENDPOINT_SLICE_X = 1.35;
// The Traffic camera looks from positive Z, so foreground support projects below the corridor.
const ENDPOINT_SLICE_Z = 3.0;
const STACK_SPACING = 1.8;

/** A stable Client -> Service -> backend corridor with EndpointSlice as supporting API state. */
export class InternalServiceTrafficLayout {
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

    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const servicePosition: Position = [SERVICE_X, 0.18, MAIN_Z];
    const endpointSlicePosition: Position = [ENDPOINT_SLICE_X, 0.18, ENDPOINT_SLICE_Z];

    addLane(layouts, containers, {
      id: 'traffic-client-lane',
      label: 'CLIENT',
      entities: clients,
      position: (_entity, index, count) => [
        CLIENT_X,
        0.18,
        MAIN_Z + (index - (count - 1) / 2) * STACK_SPACING,
      ],
      bounds: {
        center: [CLIENT_X, 0.025, MAIN_Z],
        size: [2.8, 0.05, Math.max(3.0, clients.length * STACK_SPACING + 0.8)],
      },
      labelAnchor: [CLIENT_X - 1.3, 0.1, MAIN_Z - 1.45],
    });
    addLane(layouts, containers, {
      id: 'traffic-service-context',
      label: 'SERVICE',
      entities: [service],
      position: () => servicePosition,
      bounds: { center: [SERVICE_X, 0.025, MAIN_Z], size: [3.2, 0.05, 3.0] },
      labelAnchor: [SERVICE_X - 1.45, 0.1, MAIN_Z - 1.45],
    });
    addLane(layouts, containers, {
      id: 'traffic-backend-lane',
      label: 'BACKENDS',
      entities: backends,
      position: (_entity, index, count) => [
        BACKEND_X,
        0.18,
        MAIN_Z + (index - (count - 1) / 2) * STACK_SPACING,
      ],
      bounds: {
        center: [BACKEND_X, 0.025, MAIN_Z],
        size: [3.8, 0.05, Math.max(3.0, backends.length * STACK_SPACING + 0.8)],
      },
      labelAnchor: [BACKEND_X - 1.75, 0.1, MAIN_Z - Math.max(1.45, backends.length * 0.92)],
    });
    addLane(layouts, containers, {
      id: 'traffic-endpoint-state',
      label: 'ENDPOINT STATE',
      entities: [endpointSlice],
      position: () => endpointSlicePosition,
      bounds: {
        center: [ENDPOINT_SLICE_X, 0.025, ENDPOINT_SLICE_Z],
        size: [4.1, 0.05, 2.15],
      },
      labelAnchor: [ENDPOINT_SLICE_X - 1.9, 0.1, ENDPOINT_SLICE_Z - 0.95],
    });

    placeComposedContainers(context, layouts);
    return finishTrafficLayout(context, layouts, containers);
  }
}
