import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId } from '../layoutShared';
import {
  addLane,
  finishTrafficLayout,
  placeScopeContext,
  trafficRole,
  type TrafficLayoutContext,
} from './trafficShared';

/** Gateway/HTTPRoute configuration beside the separate packet-processing data plane. */
export class GatewayConfigurationTrafficLayout {
  public calculate(context: TrafficLayoutContext, service: WorldEntity): LayoutResult {
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const clients = context.visible
      .filter((entity) => trafficRole(entity) === 'client' || entity.kind === 'Browser')
      .sort(byEntityId);
    const dataPlanes = context.visible
      .filter((entity) => entity.kind === 'GatewayDataPlane')
      .sort(byEntityId);
    const configuration = context.visible
      .filter(
        (entity) =>
          entity.kind === 'Gateway' ||
          entity.kind === 'HTTPRoute' ||
          entity.kind === 'GatewayClass',
      )
      .sort(byEntityId);

    if (dataPlanes.length === 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [
          { code: 'missing-role', role: 'gateway-data-plane', expectedKinds: ['GatewayDataPlane'] },
        ],
      });
    }
    if (configuration.length === 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [
          {
            code: 'missing-role',
            role: 'gateway-routing-configuration',
            expectedKinds: ['Gateway', 'HTTPRoute'],
          },
        ],
      });
    }

    addLane(layouts, containers, {
      id: 'gateway-config-client',
      label: 'CLIENT CONTEXT',
      entities: clients,
      position: (_entity, index, count) => [-7.2, 0.18, (index - (count - 1) / 2) * 2.3],
      bounds: { center: [-7.2, 0.025, 0], size: [2.9, 0.05, 4.4] },
    });
    addLane(layouts, containers, {
      id: 'gateway-config-data-plane',
      label: 'GATEWAY DATA PLANE',
      entities: dataPlanes,
      position: (_entity, index, count) => [-3.45, 0.18, (index - (count - 1) / 2) * 2.8],
      bounds: {
        center: [-3.45, 0.025, 0],
        size: [3.2, 0.05, Math.max(2.8, dataPlanes.length * 2.8 + 0.6)],
      },
    });
    addLane(layouts, containers, {
      id: 'gateway-config-service',
      label: 'BACKEND SERVICE REFERENCE',
      entities: [service],
      position: () => [5.15, 0.18, 0],
      bounds: { center: [5.15, 0.025, 0], size: [3.7, 0.05, 3.0] },
    });
    addLane(layouts, containers, {
      id: 'gateway-config-api-resources',
      label: 'DECLARATIVE ROUTING CONFIGURATION',
      entities: configuration,
      position: (_entity, index, count) => [0.35 + (index - (count - 1) / 2) * 3.3, 0.18, 3.45],
      bounds: {
        center: [0.35, 0.025, 3.45],
        size: [Math.max(5.2, configuration.length * 3.3 + 0.7), 0.05, 2.45],
      },
    });
    placeScopeContext(context, layouts, 'gateway-config-scope', [7.65, 0.04, 3.45]);
    return finishTrafficLayout(context, layouts, containers);
  }
}
