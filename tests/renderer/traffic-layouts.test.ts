import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ActiveTeachingRoute, ViewProjection } from '../../src/course/types';
import {
  calculateLayout,
  type LayoutInput,
  type LayoutResult,
} from '../../src/renderer/LayoutEngine';
import { LayoutContractError } from '../../src/renderer/layouts/LayoutContractError';
import {
  classifyServiceTraffic,
  type TrafficLayoutVariant,
} from '../../src/renderer/layouts/traffic/TrafficLayoutVariant';
import { buildTrafficContext } from '../../src/renderer/layouts/traffic/trafficShared';
import { countStrongXReversals } from '../../src/renderer/relations/polyline';
import type {
  EntityId,
  WorldEntity,
  WorldEntityCategory,
  WorldSnapshot,
} from '../../src/world/types';

const localized = (value: string) => ({ en: value, ja: value, 'zh-CN': value });

interface EntityOptions {
  readonly category?: WorldEntityCategory;
  readonly namespace?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly status?: WorldEntity['status'];
  readonly data?: Readonly<Record<string, unknown>>;
}

const entity = (id: EntityId, kind: string, options: EntityOptions = {}): WorldEntity => ({
  id,
  category: options.category ?? 'api-object',
  kind,
  name: id.split(':').at(-1) ?? id,
  ...(options.namespace ? { namespace: options.namespace } : {}),
  ...(options.labels ? { labels: options.labels } : {}),
  status: options.status ?? 'ready',
  data: options.data ?? {},
  title: localized(id),
  summary: localized(id),
  sourceIds: [],
  visual: { archetype: kind === 'Pod' ? 'pod' : kind === 'Service' ? 'service' : 'config' },
});

const pod = (
  id: EntityId,
  role?: 'client' | 'backend',
  version?: string,
  ready = true,
): WorldEntity =>
  entity(id, 'Pod', {
    namespace: 'shop',
    ...(version
      ? {
          labels: {
            'app.kubernetes.io/name': 'api',
            'app.kubernetes.io/version': version,
          },
        }
      : {}),
    status: ready ? 'ready' : 'not-ready',
    data: {
      uid: `uid:${id}`,
      nodeName: 'worker-a',
      phase: 'Running',
      restartPolicy: 'Always',
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: ready,
        ready,
      },
      ...(role ? { trafficRole: role } : {}),
    },
  });

const endpointSlice = (
  id: EntityId,
  serviceName: string,
  backends: readonly WorldEntity[],
): WorldEntity =>
  entity(id, 'EndpointSlice', {
    namespace: serviceName === 'kube-dns' ? 'kube-system' : 'shop',
    labels: { 'kubernetes.io/service-name': serviceName },
    data: {
      serviceName,
      endpoints: backends.map((backend) => ({
        targetRef: backend.id,
        conditions: { ready: true, serving: true, terminating: false },
      })),
    },
  });

const world = (entities: readonly WorldEntity[]): WorldSnapshot => ({
  schemaVersion: 2,
  scenarioId: 'traffic-layout-test',
  revision: 0,
  entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  relations: {},
});

const projection = (
  entities: readonly WorldEntity[],
  activeRoutes: readonly ActiveTeachingRoute[] = [],
): ViewProjection => ({
  view: 'traffic',
  cameraPresetId: 'traffic',
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

const input = (
  entities: readonly WorldEntity[],
  activeRoutes: readonly ActiveTeachingRoute[] = [],
): LayoutInput => ({ world: world(entities), view: projection(entities, activeRoutes) });

const serviceRoute = (
  id: string,
  client: WorldEntity,
  service: WorldEntity,
  slice: WorldEntity,
  backend: WorldEntity,
  intermediates: readonly WorldEntity[] = [],
): ActiveTeachingRoute => {
  const participants = [client, ...intermediates];
  return {
    id,
    semantic: 'data-flow',
    persistAfterAnimation: true,
    support: {
      serviceId: service.id,
      endpointSliceId: slice.id,
      selectedEndpointTargetId: backend.id,
    },
    hops: [
      ...participants.map((participant, index) => ({
        fromEntityId: participant.id,
        fromAnchor: 'network-out' as const,
        toEntityId: participants[index + 1]?.id ?? service.id,
        toAnchor: 'network-in' as const,
      })),
      {
        fromEntityId: service.id,
        fromAnchor: 'network-out',
        toEntityId: backend.id,
        toAnchor: 'network-in',
      },
    ],
  };
};

const position = (layout: LayoutResult, entityId: EntityId) => {
  const value = layout.entities.get(entityId)?.position;
  expect(value, `missing position for ${entityId}`).toBeDefined();
  if (!value) throw new Error(`missing position for ${entityId}`);
  return value;
};

const expectXOrder = (layout: LayoutResult, ids: readonly EntityId[]): void => {
  for (let index = 1; index < ids.length; index += 1) {
    const left = ids[index - 1];
    const right = ids[index];
    if (!left || !right) continue;
    expect(position(layout, left)[0], `${left} must be left of ${right}`).toBeLessThan(
      position(layout, right)[0],
    );
  }
};

const classify = (entities: readonly WorldEntity[]): TrafficLayoutVariant =>
  classifyServiceTraffic(buildTrafficContext(input(entities)));

describe('Traffic layout variant classifier', () => {
  const client = pod('pod:client', 'client');
  const service = entity('service:api', 'Service', {
    namespace: 'shop',
    data: { selector: { 'app.kubernetes.io/name': 'api' } },
  });
  const apiA = pod('pod:api-a', 'backend');
  const slice = endpointSlice('slice:api', 'api', [apiA]);

  it('uses visible topology instead of lesson IDs', () => {
    expect(classify([client, service, slice, apiA])).toBe('internal-service');

    const browser = entity('external:browser', 'Browser', {
      category: 'external',
      data: { trafficRole: 'client' },
    });
    const gatewayDataPlane = entity('infrastructure:gateway', 'GatewayDataPlane', {
      category: 'infrastructure',
    });
    expect(classify([browser, gatewayDataPlane, service, slice, apiA])).toBe('external-service');

    const oldPod = pod('pod:api-v1', 'backend', 'v1');
    const newPod = pod('pod:api-v2', 'backend', 'v2');
    const rolloutSlice = endpointSlice('slice:rollout', 'api', [oldPod, newPod]);
    expect(classify([client, service, rolloutSlice, oldPod, newPod])).toBe('rollout-service');

    const loneReplicaSet = entity('rs:api', 'ReplicaSet');
    expect(classify([client, service, slice, apiA, loneReplicaSet])).toBe('internal-service');

    const independentlyVersionedClient = pod('pod:client-v9', 'client', 'v9');
    expect(classify([independentlyVersionedClient, service, slice, apiA])).toBe('internal-service');

    const unrelatedVersionedPod = {
      ...pod('pod:metrics-v9', undefined, 'v9'),
      labels: {
        'app.kubernetes.io/name': 'metrics',
        'app.kubernetes.io/version': 'v9',
      },
    };
    expect(classify([client, service, slice, apiA, unrelatedVersionedPod])).toBe(
      'internal-service',
    );
  });
});

describe('Batch 03 traffic compositions', () => {
  it('keeps Request A and Request B in one left-to-right composition with stable backend slots', () => {
    const client = pod('pod:client', 'client');
    const service = entity('service:api', 'Service', { namespace: 'shop' });
    const apiA = pod('pod:api-a', 'backend');
    const apiB = pod('pod:api-b', 'backend');
    const apiC = pod('pod:api-c', 'backend');
    const slice = endpointSlice('slice:api', 'api', [apiA, apiB, apiC]);
    const entities = [client, service, slice, apiA, apiB, apiC];
    const requestA = calculateLayout(
      input(entities, [serviceRoute('request-a', client, service, slice, apiA)]),
    );
    const notReadyA = pod(apiA.id, 'backend', undefined, false);
    const notReadyEntities = [client, service, slice, notReadyA, apiB, apiC];
    const requestB = calculateLayout(
      input(notReadyEntities, [serviceRoute('request-b', client, service, slice, apiC)]),
    );

    expectXOrder(requestA, [client.id, service.id, apiA.id]);
    expectXOrder(requestB, [client.id, service.id, apiC.id]);
    for (const id of [client.id, service.id, slice.id, apiA.id, apiB.id, apiC.id]) {
      expect(position(requestB, id)).toEqual(position(requestA, id));
    }
    expect(position(requestA, slice.id)[2]).toBeGreaterThan(
      Math.max(position(requestA, client.id)[2], position(requestA, service.id)[2]),
    );

    const containerIds = requestA.containers.map((container) => container.id);
    expect(containerIds).toEqual([
      'traffic-client-lane',
      'traffic-service-context',
      'traffic-backend-lane',
      'traffic-endpoint-state',
    ]);
    expect(containerIds).not.toEqual(
      expect.arrayContaining([
        'traffic-workload-support',
        'traffic-placement-context',
        'traffic-scope-context',
      ]),
    );
  });

  it('places cluster DNS in route order and keeps EndpointSlice below as DNS endpoint state', () => {
    const client = pod('pod:dns-client', 'client');
    const kubeDns = entity('service:kube-dns', 'Service', {
      namespace: 'kube-system',
    });
    const coreDns = entity('pod:coredns-a', 'Pod', {
      namespace: 'kube-system',
      data: { trafficRole: 'backend' },
    });
    const slice = endpointSlice('slice:kube-dns', 'kube-dns', [coreDns]);
    const route: ActiveTeachingRoute = {
      id: 'dns-query',
      semantic: 'dns',
      persistAfterAnimation: true,
      hops: [
        {
          fromEntityId: client.id,
          fromAnchor: 'network-out',
          toEntityId: kubeDns.id,
          toAnchor: 'network-in',
        },
        {
          fromEntityId: kubeDns.id,
          fromAnchor: 'network-out',
          toEntityId: coreDns.id,
          toAnchor: 'network-in',
        },
      ],
    };
    const result = calculateLayout(input([client, kubeDns, slice, coreDns], [route]));

    expectXOrder(result, [client.id, kubeDns.id, coreDns.id]);
    expect(position(result, slice.id)[2]).toBeGreaterThan(position(result, kubeDns.id)[2]);
    expect(result.containers.map((container) => [container.id, container.label])).toContainEqual([
      'dns-endpoint-state',
      'DNS ENDPOINT STATE',
    ]);
    expect(result.containers.map((container) => container.label)).not.toContain(
      'LATER REQUEST CONTEXT',
    );
    expect(route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(slice.id);
  });

  it('keeps the external packet corridor monotonic and configuration outside the hop list', () => {
    const browser = entity('external:browser', 'Browser', {
      category: 'external',
      data: { trafficRole: 'client' },
    });
    const gatewayDataPlane = entity('infrastructure:gateway-data-plane', 'GatewayDataPlane', {
      category: 'infrastructure',
    });
    const gateway = entity('gateway:public', 'Gateway');
    const httpRoute = entity('http-route:shop', 'HTTPRoute');
    const service = entity('service:web', 'Service', { namespace: 'shop' });
    const backend = pod('pod:web-a', 'backend');
    const slice = endpointSlice('slice:web', 'web', [backend]);
    const route = serviceRoute('external-request', browser, service, slice, backend, [
      gatewayDataPlane,
    ]);
    const result = calculateLayout(
      input([browser, gatewayDataPlane, gateway, httpRoute, service, slice, backend], [route]),
    );

    expectXOrder(result, [browser.id, gatewayDataPlane.id, service.id, backend.id]);
    expect(position(result, slice.id)[2]).toBeGreaterThan(position(result, service.id)[2]);
    const physicalIds = route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]);
    expect(physicalIds).not.toContain(gateway.id);
    expect(physicalIds).not.toContain(httpRoute.id);
    expect(physicalIds).not.toContain(slice.id);
  });

  it('groups rollout generations to the right of Service and leaves an unready new Pod in place', () => {
    const client = pod('pod:rollout-client', 'client');
    const service = entity('service:api', 'Service', {
      namespace: 'shop',
      data: { selector: { 'app.kubernetes.io/name': 'api' } },
    });
    const oldA = pod('pod:api-v1-a', 'backend', 'v1');
    const oldB = pod('pod:api-v1-b', 'backend', 'v1');
    const newPod = pod('pod:api-v2-a', 'backend', 'v2', false);
    const slice = endpointSlice('slice:rollout', 'api', [oldA, oldB, newPod]);
    const entities = [client, service, slice, oldA, oldB, newPod];
    const result = calculateLayout(
      input(entities, [serviceRoute('rollout', client, service, slice, newPod)]),
    );

    expect(position(result, service.id)[0]).toBeLessThan(position(result, oldA.id)[0]);
    expect(position(result, service.id)[0]).toBeLessThan(position(result, newPod.id)[0]);
    expect(result.entities.get(newPod.id)?.containerId).toBe('rollout-traffic-new-backends');
    expect(result.containers.map((container) => container.id)).toEqual(
      expect.arrayContaining([
        'rollout-traffic-old-backends',
        'rollout-traffic-new-backends',
        'rollout-traffic-endpoint-state',
      ]),
    );

    const beforeAdmissionSlice = endpointSlice('slice:rollout-pending', 'api', [oldA, oldB]);
    const unadmittedNewPod = pod('pod:api-v2-pending', undefined, 'v2', false);
    const beforeAdmission = calculateLayout(
      input([client, service, beforeAdmissionSlice, oldA, oldB, unadmittedNewPod]),
    );
    expect(beforeAdmission.entities.get(unadmittedNewPod.id)?.containerId).toBe(
      'rollout-traffic-new-backends',
    );
  });

  it('omits empty Placement workload and pending guides', () => {
    const node = entity('node:worker-a', 'Node', {
      category: 'infrastructure',
      data: { rackOrder: 0 },
    });
    const assigned = pod('pod:assigned');
    const entities = [node, assigned];
    const view: ViewProjection = {
      ...projection(entities),
      view: 'placement',
      cameraPresetId: 'placement',
    };
    const result = calculateLayout({ world: world(entities), view });
    const containerIds = result.containers.map((container) => container.id);

    expect(containerIds).not.toContain('workload-state-zone');
    expect(containerIds).not.toContain('pending-lane');
  });

  it('keeps strict unassigned-entity behavior', () => {
    const client = pod('pod:client', 'client');
    const service = entity('service:api', 'Service');
    const backend = pod('pod:api-a', 'backend');
    const slice = endpointSlice('slice:api', 'api', [backend]);
    const unknown = entity('mystery:thing', 'MysteryObject');

    expect(() => calculateLayout(input([client, service, slice, backend, unknown]))).toThrowError(
      LayoutContractError,
    );
  });

  it('diagnoses a strong X hairpin while tolerating a tiny clearance jog', () => {
    const readable = [
      new THREE.Vector3(-6, 0, 0),
      new THREE.Vector3(-0.05, 0, 0.2),
      new THREE.Vector3(-0.12, 0, 0.4),
      new THREE.Vector3(6, 0, 0),
    ];
    const hairpin = [
      new THREE.Vector3(-6, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-2, 0, 1),
      new THREE.Vector3(6, 0, 0),
    ];

    expect(countStrongXReversals(readable)).toBe(0);
    expect(countStrongXReversals(hairpin)).toBe(1);
  });
});
