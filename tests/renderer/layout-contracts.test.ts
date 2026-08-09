import { describe, expect, it } from 'vitest';
import type { ActiveTeachingRoute, ViewMode, ViewProjection } from '../../src/course/types';
import { calculateLayout, type LayoutContainer } from '../../src/renderer/LayoutEngine';
import { LayoutContractError } from '../../src/renderer/layouts/LayoutContractError';
import type {
  EntityId,
  WorldEntity,
  WorldEntityCategory,
  WorldSnapshot,
} from '../../src/world/types';

const localized = (value: string) => ({ en: value, ja: value, 'zh-CN': value });

const entity = (
  id: EntityId,
  kind: string,
  data: Readonly<Record<string, unknown>> = {},
  category: WorldEntityCategory = 'api-object',
): WorldEntity => ({
  id,
  category,
  kind,
  name: id.split(':').at(-1) ?? id,
  status: 'ready',
  data,
  title: localized(id),
  summary: localized(id),
  sourceIds: [],
  visual: { archetype: kind === 'Pod' ? 'pod' : kind === 'Service' ? 'service' : 'config' },
});

const pod = (id: EntityId, nodeName?: string, trafficRole?: 'client' | 'backend'): WorldEntity =>
  entity(id, 'Pod', {
    uid: `uid:${id}`,
    ...(nodeName ? { nodeName } : {}),
    phase: nodeName ? 'Running' : 'Pending',
    restartPolicy: 'Always',
    conditions: {
      podScheduled: Boolean(nodeName),
      initialized: Boolean(nodeName),
      containersReady: Boolean(nodeName),
      ready: Boolean(nodeName),
    },
    ...(trafficRole ? { trafficRole } : {}),
  });

const world = (entities: readonly WorldEntity[]): WorldSnapshot => ({
  schemaVersion: 2,
  scenarioId: 'layout-contract-test',
  revision: 0,
  entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  relations: {},
});

const projection = (
  view: ViewMode,
  entities: readonly WorldEntity[],
  activeRoutes: readonly ActiveTeachingRoute[] = [],
): ViewProjection => ({
  view,
  cameraPresetId: view,
  entityStates: Object.fromEntries(
    entities.map((item) => [
      item.id,
      {
        visible: true,
        emphasis: 'normal' as const,
        labelMode: 'short' as const,
        inspectorMode: 'none' as const,
      },
    ]),
  ),
  relationStates: {},
  callouts: [],
  activeRoutes,
});

describe('strict guided layout contracts', () => {
  it('fails loudly instead of falling back to Placement when Traffic roles are missing', () => {
    const client = pod('pod:client', 'worker-a', 'client');
    const snapshot = world([client]);

    expect(() =>
      calculateLayout({
        world: snapshot,
        view: projection('traffic', [client]),
      }),
    ).toThrowError(LayoutContractError);
  });

  it('places a Traffic request source, Service, and backend left-to-right without remainder lanes', () => {
    const client = pod('pod:client', 'worker-client', 'client');
    const service = entity('service:api', 'Service');
    const backend = pod('pod:api-a', 'worker-app', 'backend');
    const endpointSlice = entity('endpoint-slice:api', 'EndpointSlice', {
      endpoints: [
        {
          targetRef: backend.id,
          conditions: { ready: true, serving: true, terminating: false },
        },
      ],
    });
    const entities = [client, service, endpointSlice, backend];
    const route: ActiveTeachingRoute = {
      id: 'request-a',
      semantic: 'data-flow',
      persistAfterAnimation: true,
      support: {
        serviceId: service.id,
        endpointSliceId: endpointSlice.id,
        selectedEndpointTargetId: backend.id,
      },
      hops: [
        {
          fromEntityId: client.id,
          fromAnchor: 'network-out',
          toEntityId: service.id,
          toAnchor: 'network-in',
        },
        {
          fromEntityId: service.id,
          fromAnchor: 'network-out',
          toEntityId: backend.id,
          toAnchor: 'network-in',
        },
      ],
    };

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities, [route]),
    });

    expect(result.entities.get(client.id)?.position[0]).toBeLessThan(
      result.entities.get(service.id)?.position[0] ?? Number.NEGATIVE_INFINITY,
    );
    expect(result.entities.get(service.id)?.position[0]).toBeLessThan(
      result.entities.get(backend.id)?.position[0] ?? Number.NEGATIVE_INFINITY,
    );
    expect(result.containers.map((container) => container.id)).not.toContain('placement-context');
    expect(result.containers.map((container) => container.id)).not.toContain('traffic-context');
  });

  it('supports a Service/EndpointSlice evidence step without inventing a client lane', () => {
    const service = entity('service:api', 'Service');
    const backend = pod('pod:api-a', 'worker-app', 'backend');
    const endpointSlice = entity('endpoint-slice:api', 'EndpointSlice', {
      endpoints: [{ targetRef: backend.id }],
    });
    const entities = [service, endpointSlice, backend];

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).not.toContain('traffic-client-lane');
    expect(containerIds).toContain('traffic-service-context');
    expect(containerIds).toContain('traffic-backend-lane');
  });

  it('omits empty worker and transit zones in a control-plane-only step', () => {
    const apiServer = entity('control:api-server', 'KubeAPIServer', {}, 'runtime-component');
    const scheduler = entity('control:scheduler', 'Scheduler', {}, 'runtime-component');
    const entities = [apiServer, scheduler];

    const result = calculateLayout({
      world: world(entities),
      view: projection('control-flow', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toEqual(['control-flow-control-plane']);
    expect(containerIds).not.toContain('control-flow-worker-zone');
    expect(containerIds).not.toContain('control-flow-transit');
  });

  it('shows the transit zone only when an unscheduled Pod is visible', () => {
    const apiServer = entity('control:api-server', 'KubeAPIServer', {}, 'runtime-component');
    const scheduler = entity('control:scheduler', 'Scheduler', {}, 'runtime-component');
    const pending = pod('pod:pending');
    const entities = [apiServer, scheduler, pending];

    const result = calculateLayout({
      world: world(entities),
      view: projection('control-flow', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toContain('control-flow-transit');
    expect(containerIds).not.toContain('control-flow-worker-zone');
    expect(result.entities.get(pending.id)?.lane).toBe('pending');
  });

  it('does not mislabel a scheduled Pod as unscheduled when its Node is intentionally hidden', () => {
    const apiServer = entity('control:api-server', 'KubeAPIServer', {}, 'runtime-component');
    const scheduled = pod('pod:assigned', 'worker-hidden');
    const entities = [apiServer, scheduled];

    const result = calculateLayout({
      world: world(entities),
      view: projection('control-flow', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(result.entities.get(scheduled.id)?.lane).toBe('workload-state');
    expect(containerIds).toContain('control-flow-assigned-pod-context');
    expect(containerIds).not.toContain('control-flow-transit');
  });

  it('does not create an empty Control Plane zone for an external actor by itself', () => {
    const developer = entity('external:developer', 'Developer', {}, 'external');
    const result = calculateLayout({
      world: world([developer]),
      view: projection('control-flow', [developer]),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toEqual(['control-flow-external-input']);
    expect(containerIds).not.toContain('control-flow-control-plane');
  });

  it('supports a stable Service identity beat before EndpointSlice is introduced', () => {
    const client = pod('pod:client', 'worker-client', 'client');
    const service = entity('service:api', 'Service');
    const entities = [client, service];

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toContain('service-identity-client-context');
    expect(containerIds).toContain('service-identity-entry');
    expect(containerIds).not.toContain('gateway-config-api-resources');
  });

  it('supports an EndpointSlice inventory card even when backend Pods are intentionally hidden', () => {
    const client = pod('pod:client', 'worker-client', 'client');
    const service = entity('service:api', 'Service');
    const endpointSlice = entity('endpoint-slice:api', 'EndpointSlice', {
      endpoints: [{ targetRef: 'pod:hidden-backend' }],
    });
    const entities = [client, service, endpointSlice];

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toContain('traffic-service-context');
    expect(containerIds).not.toContain('traffic-backend-lane');
  });

  it('supports the external orientation beat before Service topology is introduced', () => {
    const browser = entity('external:browser', 'Browser', { trafficRole: 'client' }, 'external');
    const publicDns = entity('external:public-dns', 'PublicDNS', {}, 'external');
    const dataPlane = entity(
      'infrastructure:gateway-data-plane',
      'GatewayDataPlane',
      {},
      'infrastructure',
    );
    const entities = [browser, publicDns, dataPlane];

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toContain('external-orientation-client');
    expect(containerIds).toContain('external-orientation-dns');
    expect(containerIds).toContain('external-orientation-entry');
    expect(containerIds).not.toContain('traffic-service-context');
  });

  it('supports Gateway and HTTPRoute configuration before EndpointSlice is introduced', () => {
    const browser = entity('external:browser', 'Browser', { trafficRole: 'client' }, 'external');
    const gateway = entity('gateway:public', 'Gateway');
    const httpRoute = entity('http-route:shop', 'HTTPRoute');
    const dataPlane = entity(
      'infrastructure:gateway-data-plane',
      'GatewayDataPlane',
      {},
      'infrastructure',
    );
    const service = entity('service:web', 'Service');
    const entities = [browser, gateway, httpRoute, dataPlane, service];

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities),
    });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).toContain('gateway-config-api-resources');
    expect(containerIds).toContain('gateway-config-data-plane');
    expect(containerIds).toContain('gateway-config-service');
    expect(containerIds).not.toContain('traffic-backend-lane');
  });

  it('keeps a public DNS route explicit without requiring an in-cluster Service', () => {
    const browser = entity('external:browser', 'Browser', { trafficRole: 'client' }, 'external');
    const publicDns = entity('external:public-dns', 'PublicDNS', {}, 'external');
    const dataPlane = entity(
      'infrastructure:gateway-data-plane',
      'GatewayDataPlane',
      {},
      'infrastructure',
    );
    const entities = [browser, publicDns, dataPlane];
    const dnsRoute: ActiveTeachingRoute = {
      id: 'public-dns',
      semantic: 'dns',
      persistAfterAnimation: true,
      hops: [
        {
          fromEntityId: browser.id,
          fromAnchor: 'network-out',
          toEntityId: publicDns.id,
          toAnchor: 'network-in',
        },
      ],
    };

    const result = calculateLayout({
      world: world(entities),
      view: projection('traffic', entities, [dnsRoute]),
    });
    const browserX = result.entities.get(browser.id)?.position[0];
    const dnsX = result.entities.get(publicDns.id)?.position[0];

    expect(browserX).toBeLessThan(dnsX ?? Number.NEGATIVE_INFINITY);
    expect(result.containers.map((container) => container.id)).toContain('dns-route-lane');
    expect(result.containers.map((container) => container.id)).toContain('dns-support-context');
  });

  it('rejects a visible Traffic entity that has no explicit semantic role', () => {
    const client = pod('pod:client', 'worker-client', 'client');
    const service = entity('service:api', 'Service');
    const backend = pod('pod:api-a', 'worker-app', 'backend');
    const endpointSlice = entity('endpoint-slice:api', 'EndpointSlice', {
      endpoints: [{ targetRef: backend.id }],
    });
    const unknown = entity('unknown:thing', 'MysteryObject');
    const entities = [client, service, endpointSlice, backend, unknown];

    expect(() =>
      calculateLayout({
        world: world(entities),
        view: projection('traffic', entities),
      }),
    ).toThrowError(/unassigned visible entities/);
  });
});

interface Footprint {
  readonly centerX: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
}

const footprintsOverlap = (left: Footprint, right: Footprint): boolean =>
  Math.abs(left.centerX - right.centerX) < (left.width + right.width) / 2 &&
  Math.abs(left.centerZ - right.centerZ) < (left.depth + right.depth) / 2;

const footprintFits = (inner: Footprint, outer: Footprint): boolean =>
  Math.abs(inner.centerX - outer.centerX) + inner.width / 2 <= outer.width / 2 &&
  Math.abs(inner.centerZ - outer.centerZ) + inner.depth / 2 <= outer.depth / 2;

describe('control-flow zone separation', () => {
  const node = (name: string): WorldEntity =>
    entity(`node:${name}`, 'Node', { podSlotCount: 4 }, 'infrastructure');

  const controlFlowContainers = (entities: readonly WorldEntity[]): readonly LayoutContainer[] =>
    calculateLayout({
      world: world(entities),
      view: projection('control-flow', entities),
    }).containers;

  const footprint = (container: LayoutContainer): Footprint => ({
    centerX: container.bounds.center[0],
    centerZ: container.bounds.center[2],
    width: container.bounds.size[0],
    depth: container.bounds.size[2],
  });

  /** Top-level semantic plates. Node racks are deliberately nested inside the Worker zone. */
  const semanticPlates = (containers: readonly LayoutContainer[]): readonly LayoutContainer[] =>
    containers.filter((container) => container.kind !== 'node-rack');

  const expectNoSemanticOverlap = (containers: readonly LayoutContainer[]): void => {
    const plates = semanticPlates(containers);
    for (let left = 0; left < plates.length; left += 1) {
      for (let right = left + 1; right < plates.length; right += 1) {
        const a = plates[left];
        const b = plates[right];
        if (!a || !b) continue;
        const overlapping = footprintsOverlap(footprint(a), footprint(b));
        expect(
          overlapping,
          `${a.id} must not intersect ${b.id}: ` +
            `${a.id}=${JSON.stringify(footprint(a))} ${b.id}=${JSON.stringify(footprint(b))}`,
        ).toBe(false);
      }
    }
  };

  const apiServer = entity('control:api-server', 'KubeAPIServer', {}, 'runtime-component');
  const scheduler = entity('control:scheduler', 'Scheduler', {}, 'runtime-component');
  const deployment = entity('workload:api', 'Deployment', { specReplicas: 3 });
  const replicaSet = entity('workload:api-rs', 'ReplicaSet', { specReplicas: 3 });

  it('keeps the Control Plane and Worker zones apart', () => {
    const entities = [apiServer, scheduler, node('worker-a'), pod('pod:a', 'worker-a')];
    const containers = controlFlowContainers(entities);

    expect(containers.map((container) => container.id)).toContain('control-flow-worker-zone');
    expectNoSemanticOverlap(containers);
  });

  it('keeps Control Plane, Workload State, and Worker zones apart', () => {
    const entities = [
      apiServer,
      deployment,
      replicaSet,
      node('worker-a'),
      pod('pod:a', 'worker-a'),
    ];
    const containers = controlFlowContainers(entities);

    expect(containers.map((container) => container.id)).toContain('control-flow-workload-state');
    expectNoSemanticOverlap(containers);
  });

  it('keeps Workload State, Transit, and Worker zones apart', () => {
    const entities = [
      apiServer,
      deployment,
      pod('pod:pending'),
      node('worker-a'),
      pod('pod:a', 'worker-a'),
    ];
    const containers = controlFlowContainers(entities);

    expect(containers.map((container) => container.id)).toContain('control-flow-transit');
    expectNoSemanticOverlap(containers);
  });

  it('keeps Workload State, Transit, Assigned Pod Context, and Worker zones apart', () => {
    const entities = [
      apiServer,
      deployment,
      replicaSet,
      pod('pod:pending'),
      pod('pod:assigned', 'worker-hidden'),
      node('worker-a'),
      pod('pod:a', 'worker-a'),
    ];
    const containers = controlFlowContainers(entities);
    const containerIds = containers.map((container) => container.id);

    expect(containerIds).toContain('control-flow-workload-state');
    expect(containerIds).toContain('control-flow-transit');
    expect(containerIds).toContain('control-flow-assigned-pod-context');
    expect(containerIds).toContain('control-flow-worker-zone');
    expectNoSemanticOverlap(containers);
  });

  it('keeps the Assigned Pod Context clear of the Worker zone when its Node is hidden', () => {
    const entities = [
      apiServer,
      pod('pod:assigned', 'worker-hidden'),
      node('worker-a'),
      pod('pod:a', 'worker-a'),
    ];
    const containers = controlFlowContainers(entities);
    const assigned = containers.find(
      (container) => container.id === 'control-flow-assigned-pod-context',
    );
    const workers = containers.find((container) => container.id === 'control-flow-worker-zone');

    expect(assigned).toBeDefined();
    expect(workers).toBeDefined();
    if (!assigned || !workers) return;
    expect(footprintsOverlap(footprint(assigned), footprint(workers))).toBe(false);
    expectNoSemanticOverlap(containers);
  });

  it('nests Node racks inside the Worker zone instead of beside it', () => {
    const entities = [node('worker-a'), node('worker-b'), pod('pod:a', 'worker-a')];
    const containers = controlFlowContainers(entities);
    const workers = containers.find((container) => container.id === 'control-flow-worker-zone');
    const racks = containers.filter((container) => container.kind === 'node-rack');

    expect(workers).toBeDefined();
    expect(racks).toHaveLength(2);
    if (!workers) return;
    for (const rack of racks) {
      expect(footprintFits(footprint(rack), footprint(workers))).toBe(true);
    }
  });

  it('emits no empty semantic zone for a control-plane-only step', () => {
    const containers = controlFlowContainers([apiServer, scheduler]);

    expect(containers.map((container) => container.id)).toEqual(['control-flow-control-plane']);
    for (const container of containers) {
      expect(container.slots.some((slot) => slot.occupiedBy !== undefined)).toBe(true);
    }
  });
});
