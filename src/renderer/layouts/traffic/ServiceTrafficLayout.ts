import type { WorldEntity } from '../../../world/types';
import type { LayoutResult } from '../../LayoutEngine';
import { ExternalServiceTrafficLayout } from './ExternalServiceTrafficLayout';
import { InternalServiceTrafficLayout } from './InternalServiceTrafficLayout';
import { RolloutServiceTrafficLayout } from './RolloutServiceTrafficLayout';
import { classifyServiceTraffic, type TrafficLayoutVariant } from './TrafficLayoutVariant';
import type { TrafficLayoutContext } from './trafficShared';

/** Compatibility router that delegates complete Service topologies to one explicit template. */
export class ServiceTrafficLayout {
  private readonly internal = new InternalServiceTrafficLayout();
  private readonly external = new ExternalServiceTrafficLayout();
  private readonly rollout = new RolloutServiceTrafficLayout();

  public calculate(
    context: TrafficLayoutContext,
    service: WorldEntity,
    endpointSlice: WorldEntity,
  ): LayoutResult {
    const variant: TrafficLayoutVariant = classifyServiceTraffic(context);
    switch (variant) {
      case 'external-service':
        return this.external.calculate(context, service, endpointSlice);
      case 'rollout-service':
        return this.rollout.calculate(context, service, endpointSlice);
      case 'internal-service':
        return this.internal.calculate(context, service, endpointSlice);
    }
  }
}
