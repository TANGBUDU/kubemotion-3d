import type { WorldEntity } from '../../world/types';
import type { LayoutInput, LayoutModule, LayoutResult } from '../LayoutEngine';
import { LayoutContractError } from './LayoutContractError';
import { uniqueRole } from './layoutShared';
import { DnsOnlyTrafficLayout } from './traffic/DnsOnlyTrafficLayout';
import { ExternalOrientationTrafficLayout } from './traffic/ExternalOrientationTrafficLayout';
import { GatewayConfigurationTrafficLayout } from './traffic/GatewayConfigurationTrafficLayout';
import { ServiceIdentityTrafficLayout } from './traffic/ServiceIdentityTrafficLayout';
import { ServiceTrafficLayout } from './traffic/ServiceTrafficLayout';
import { buildTrafficContext } from './traffic/trafficShared';

const EXTERNAL_ORIENTATION_KINDS: ReadonlySet<string> = new Set([
  'Browser',
  'PublicDNS',
  'GatewayDataPlane',
  'Gateway',
  'HTTPRoute',
]);

/** True when the snapshot carries at least one object an external traffic beat can be built from. */
const hasExternalOrientationContext = (visible: readonly WorldEntity[]): boolean =>
  visible.some((entity) => EXTERNAL_ORIENTATION_KINDS.has(entity.kind));

/**
 * Strict router for guided Traffic layouts.
 *
 * Every supported traffic beat has an explicit contract. The router never falls back to Placement
 * and never drops unknown entities into a generic remainder row.
 */
export class StrictTrafficLayout implements LayoutModule {
  public readonly view = 'traffic' as const;

  private readonly dnsOnly = new DnsOnlyTrafficLayout();
  private readonly externalOrientation = new ExternalOrientationTrafficLayout();
  private readonly gatewayConfiguration = new GatewayConfigurationTrafficLayout();
  private readonly serviceIdentity = new ServiceIdentityTrafficLayout();
  private readonly serviceTraffic = new ServiceTrafficLayout();

  public calculate(input: LayoutInput): LayoutResult {
    const context = buildTrafficContext(input);
    const hasService = context.serviceCandidates.length > 0;
    const hasEndpointSlice = context.endpointSliceCandidates.length > 0;
    const allActiveRoutesAreDns =
      input.view.activeRoutes.length > 0 &&
      input.view.activeRoutes.every((route) => route.semantic === 'dns');

    if (!hasService && !hasEndpointSlice && allActiveRoutesAreDns) {
      return this.dnsOnly.calculate(context);
    }

    if (!hasService && !hasEndpointSlice && input.view.activeRoutes.length === 0) {
      // A world with no Service, no EndpointSlice and no external traffic object has no traffic
      // story at all. Treating it as an External Orientation beat would invent a client lane for a
      // snapshot that never had one, so state the missing topology instead.
      if (!hasExternalOrientationContext(context.visible)) {
        throw new LayoutContractError({
          view: input.view.view,
          scenarioId: input.world.scenarioId,
          issues: [
            {
              code: 'missing-role',
              role: 'traffic-topology',
              expectedKinds: [
                'Service',
                'EndpointSlice',
                'Browser',
                'PublicDNS',
                'GatewayDataPlane',
              ],
            },
          ],
        });
      }
      return this.externalOrientation.calculate(context);
    }

    if (hasService && !hasEndpointSlice && input.view.activeRoutes.length === 0) {
      const service = uniqueRole(input, 'stable-service-entry', context.serviceCandidates, [
        'Service',
      ]);
      const hasGatewayContext = context.visible.some(
        (entity) =>
          entity.kind === 'Gateway' ||
          entity.kind === 'HTTPRoute' ||
          entity.kind === 'GatewayClass' ||
          entity.kind === 'GatewayDataPlane',
      );
      return hasGatewayContext
        ? this.gatewayConfiguration.calculate(context, service)
        : this.serviceIdentity.calculate(context, service);
    }

    const service = uniqueRole(input, 'stable-service-entry', context.serviceCandidates, [
      'Service',
    ]);
    const endpointSlice = uniqueRole(input, 'endpoint-inventory', context.endpointSliceCandidates, [
      'EndpointSlice',
    ]);
    return this.serviceTraffic.calculate(context, service, endpointSlice);
  }
}
