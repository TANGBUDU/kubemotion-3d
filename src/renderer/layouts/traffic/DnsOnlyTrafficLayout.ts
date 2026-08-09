import type { EntityId } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult } from '../../LayoutEngine';
import { LayoutContractError } from '../LayoutContractError';
import { byEntityId } from '../layoutShared';
import { addLane, finishTrafficLayout, type TrafficLayoutContext } from './trafficShared';

/** A DNS route that intentionally has no in-cluster Service/EndpointSlice topology. */
export class DnsOnlyTrafficLayout {
  public calculate(context: TrafficLayoutContext): LayoutResult {
    const routeEntities = context.visible.filter((entity) => context.routeEntityIds.has(entity.id));
    if (routeEntities.length < 2) {
      throw new LayoutContractError({
        view: context.input.view.view,
        scenarioId: context.input.world.scenarioId,
        issues: [{ code: 'missing-role', role: 'dns-route-endpoints' }],
      });
    }

    const orderedIds: EntityId[] = [];
    for (const route of context.input.view.activeRoutes) {
      for (const hop of route.hops) {
        if (!orderedIds.includes(hop.fromEntityId)) orderedIds.push(hop.fromEntityId);
        if (!orderedIds.includes(hop.toEntityId)) orderedIds.push(hop.toEntityId);
      }
    }
    const ordered = orderedIds
      .map((id) => context.visibleById.get(id))
      .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const spacing = ordered.length > 1 ? Math.min(5.0, 14 / (ordered.length - 1)) : 4.5;

    addLane(layouts, containers, {
      id: 'dns-route-lane',
      label: 'DNS QUERY / RESPONSE',
      entities: ordered,
      position: (_entity, index, count) => [(index - (count - 1) / 2) * spacing, 0.18, 0],
      bounds: {
        center: [0, 0.025, 0],
        size: [Math.max(7, ordered.length * spacing + 1.5), 0.05, 4.2],
      },
    });

    const allowedSupport = context.visible
      .filter((entity) => !layouts.has(entity.id))
      .filter((entity) =>
        ['Gateway', 'HTTPRoute', 'GatewayDataPlane', 'Service', 'EndpointSlice'].includes(
          entity.kind,
        ),
      )
      .sort(byEntityId);
    addLane(layouts, containers, {
      id: 'dns-support-context',
      label: 'LATER REQUEST CONTEXT',
      entities: allowedSupport,
      position: (_entity, index, count) => [(index - (count - 1) / 2) * 3.1, 0.18, 3.55],
      bounds: {
        center: [0, 0.025, 3.55],
        size: [Math.max(4.2, allowedSupport.length * 3.1), 0.05, 2.3],
      },
    });

    return finishTrafficLayout(context, layouts, containers);
  }
}
