import type { EntityId } from '../../../world/types';
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

/** Browser/Public-DNS/Gateway orientation before an in-cluster Service path is introduced. */
export class ExternalOrientationTrafficLayout {
  public calculate(context: TrafficLayoutContext): LayoutResult {
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const clients = context.visible
      .filter((entity) => trafficRole(entity) === 'client' || entity.kind === 'Browser')
      .sort(byEntityId);
    const dnsSystems = context.visible
      .filter((entity) => entity.kind === 'PublicDNS')
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

    if (clients.length === 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'external-client', expectedKinds: ['Browser'] }],
      });
    }
    if (dnsSystems.length === 0 && dataPlanes.length === 0) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [
          {
            code: 'missing-role',
            role: 'external-orientation-context',
            expectedKinds: ['PublicDNS', 'GatewayDataPlane'],
          },
        ],
      });
    }

    addLane(layouts, containers, {
      id: 'external-orientation-client',
      label: 'BROWSER',
      entities: clients,
      position: (_entity, index, count) => [-6.3, 0.18, (index - (count - 1) / 2) * 2.3],
      bounds: { center: [-6.3, 0.025, 0], size: [3.25, 0.05, 4.9] },
    });
    addLane(layouts, containers, {
      id: 'external-orientation-dns',
      label: 'PUBLIC DNS',
      entities: dnsSystems,
      position: (_entity, index, count) => [-0.9, 0.18, -1.4 + (index - (count - 1) / 2) * 2.3],
      bounds: { center: [-0.9, 0.025, -1.4], size: [3.25, 0.05, 3.1] },
    });
    addLane(layouts, containers, {
      id: 'external-orientation-entry',
      label: 'FUTURE HTTPS ENTRY',
      entities: dataPlanes,
      position: (_entity, index, count) => [4.8, 0.18, (index - (count - 1) / 2) * 2.3],
      bounds: { center: [4.8, 0.025, 0], size: [3.25, 0.05, 4.9] },
    });
    addLane(layouts, containers, {
      id: 'external-orientation-configuration',
      label: 'FUTURE ROUTING CONFIGURATION',
      entities: configuration,
      position: (_entity, index, count) => [1.9 + (index - (count - 1) / 2) * 3.1, 0.18, 3.35],
      bounds: {
        center: [1.9, 0.025, 3.35],
        size: [Math.max(4.2, configuration.length * 3.1), 0.05, 2.25],
      },
    });
    placeScopeContext(context, layouts, 'external-orientation-scope', [7.7, 0.04, 3.35]);
    return finishTrafficLayout(context, layouts, containers);
  }
}
