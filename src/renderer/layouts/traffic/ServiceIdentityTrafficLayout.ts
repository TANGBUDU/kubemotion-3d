import type { EntityId, WorldEntity } from '../../../world/types';
import type { EntityLayout, LayoutContainer, LayoutResult } from '../../LayoutEngine';
import { byEntityId } from '../layoutShared';
import {
  addLane,
  finishTrafficLayout,
  placeScopeContext,
  trafficRole,
  type TrafficLayoutContext,
} from './trafficShared';

/** A Service identity beat before EndpointSlice/backend inventory is introduced. */
export class ServiceIdentityTrafficLayout {
  public calculate(context: TrafficLayoutContext, service: WorldEntity): LayoutResult {
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const clients = context.visible
      .filter((entity) => trafficRole(entity) === 'client' || entity.kind === 'Browser')
      .sort(byEntityId);

    addLane(layouts, containers, {
      id: 'service-identity-client-context',
      label: 'CLIENT CONTEXT',
      entities: clients,
      position: (_entity, index, count) => [-4.6, 0.18, (index - (count - 1) / 2) * 2.3],
      bounds: { center: [-4.6, 0.025, 0], size: [3.0, 0.05, 4.6] },
    });
    addLane(layouts, containers, {
      id: 'service-identity-entry',
      label: 'STABLE SERVICE IDENTITY',
      entities: [service],
      position: () => [1.2, 0.18, 0],
      bounds: { center: [1.2, 0.025, 0], size: [4.3, 0.05, 4.2] },
    });
    placeScopeContext(context, layouts, 'service-identity-scope', [5.4, 0.04, 2.5]);
    return finishTrafficLayout(context, layouts, containers);
  }
}
