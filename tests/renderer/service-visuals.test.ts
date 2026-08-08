import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lessonById, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { calculateLayout } from '../../src/renderer/LayoutEngine';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';
import { SceneRegistry } from '../../src/renderer/SceneRegistry';
import {
  ClientVisualHandle,
  EndpointSliceVisualHandle,
  ServiceVisualHandle,
} from '../../src/renderer/VisualHandles';

const SERVICE = 'api-object:namespaced:shop:Service:api';
const SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const CLIENT = 'api-object:namespaced:shop:Pod:traffic-client';
const API_A = 'api-object:namespaced:shop:Pod:api-a';
const API_C = 'api-object:namespaced:shop:Pod:api-c';
const lesson = lessonById.get('service-routes-to-pods');
if (!lesson) throw new Error('Service lesson is missing');
const scenario = scenarioById.get(lesson.scenarioId);
if (!scenario) throw new Error('Service scenario is missing');
const compiled = courseEngine.compileLesson(lesson, scenario);
const baseline = compiled.steps[0]!;
const requestA = compiled.steps[3]!;
const notReady = compiled.steps[4]!;
const requestC = compiled.steps[5]!;

function roles(root: THREE.Object3D): string[] {
  const values: string[] = [];
  root.traverse((object) => {
    if (typeof object.userData.role === 'string') values.push(object.userData.role);
  });
  return values;
}

describe('Service lesson specialized visuals', () => {
  it('resolves dedicated client, Service, and EndpointSlice factories with legible metadata', () => {
    const registry = new VisualFactoryRegistry();
    const client = registry.create(
      baseline.world.entities[CLIENT]!,
      baseline.view.entityStates[CLIENT]!,
      { allowGeneric: false },
    );
    const service = registry.create(
      baseline.world.entities[SERVICE]!,
      baseline.view.entityStates[SERVICE]!,
      { allowGeneric: false },
    );
    const endpointSlice = registry.create(
      baseline.world.entities[SLICE]!,
      baseline.view.entityStates[SLICE]!,
      { allowGeneric: false },
    );

    expect(client).toBeInstanceOf(ClientVisualHandle);
    expect(service).toBeInstanceOf(ServiceVisualHandle);
    expect(endpointSlice).toBeInstanceOf(EndpointSliceVisualHandle);
    expect(roles(client.root)).toEqual(
      expect.arrayContaining([
        'client-request-mast',
        'client-request-signal',
        'client-request-arrow',
      ]),
    );
    expect(service.root.userData.domLabel.text).toBe('Service • api');
    expect(service.root.userData.domLabel.text).not.toContain('198.51.100.42');
    expect(service.root.userData).toMatchObject({
      clusterIP: '198.51.100.42',
      port: 8080,
      protocol: 'TCP',
    });
    expect(service.root.userData.stableEntry).toBe(true);
    expect(roles(service.root)).toEqual(
      expect.arrayContaining(['service-stable-ring', 'service-portal', 'service-status-rail']),
    );
    expect(endpointSlice.root.userData.domLabel.text).toContain('R3/3');
    expect(endpointSlice.root.userData.endpointCount).toBe(3);
    expect(endpointSlice.root.userData.readyEndpointCount).toBe(3);
    for (const handle of [client, service, endpointSlice]) {
      expect(handle.root.userData.genericVisual).not.toBe(true);
      handle.dispose();
    }
  });

  it('exposes distinct ingress and egress anchors for the physical traffic path', () => {
    const registry = new VisualFactoryRegistry();
    const client = registry.create(
      baseline.world.entities[CLIENT]!,
      baseline.view.entityStates[CLIENT]!,
      { allowGeneric: false },
    );
    const service = registry.create(
      baseline.world.entities[SERVICE]!,
      baseline.view.entityStates[SERVICE]!,
      { allowGeneric: false },
    );
    const backend = registry.create(
      baseline.world.entities[API_A]!,
      baseline.view.entityStates[API_A]!,
      { allowGeneric: false },
    );

    for (const handle of [client, service, backend]) {
      expect(handle.getAnchor('network-in').equals(handle.getAnchor('network-out'))).toBe(false);
      handle.dispose();
    }
  });

  it('updates endpoint readiness in place and exposes a non-color NotReady mark', () => {
    const handle = new EndpointSliceVisualHandle(
      baseline.world.entities[SLICE]!,
      baseline.view.entityStates[SLICE]!,
    );
    const slotUuids = handle.endpointSlots.map((slot) => slot.uuid);
    handle.update(notReady.world.entities[SLICE]!, notReady.view.entityStates[SLICE]!);
    expect(handle.endpointSlots.map((slot) => slot.uuid)).toEqual(slotUuids);
    expect(handle.root.userData.readyEndpointCount).toBe(2);
    expect(handle.endpointSlots[0]?.userData).toMatchObject({
      targetRef: API_A,
      ready: false,
      serving: false,
      terminating: false,
    });
    expect(handle.root.userData.endpointStates[0]).toEqual({
      address: '192.0.2.11',
      targetRef: API_A,
      ready: false,
      serving: false,
      terminating: false,
    });
    const notReadyRoles: string[] = [];
    handle.endpointSlots[0]?.traverse((object) => {
      if (object.visible && typeof object.userData.role === 'string') {
        notReadyRoles.push(object.userData.role);
      }
    });
    expect(notReadyRoles).toEqual(
      expect.arrayContaining(['endpoint-not-ready-ring', 'endpoint-not-ready-slash']),
    );
    expect(handle.root.userData.domLabel.text).toContain('R2/3');
    handle.dispose();
  });

  it('treats an omitted EndpointConditions.ready value as true', () => {
    const entity = structuredClone(baseline.world.entities[SLICE]!);
    const endpoints = entity.data.endpoints;
    if (!Array.isArray(endpoints)) throw new Error('EndpointSlice endpoints are missing');
    const first = endpoints[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) {
      throw new Error('First EndpointSlice endpoint is missing');
    }
    const conditions = first.conditions;
    if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
      throw new Error('First EndpointSlice conditions are missing');
    }
    delete (conditions as Record<string, unknown>).ready;

    const handle = new EndpointSliceVisualHandle(entity, baseline.view.entityStates[SLICE]!);
    expect(handle.endpointSlots[0]?.userData).toMatchObject({
      ready: true,
      serving: true,
      terminating: false,
    });
    expect(handle.root.userData.readyEndpointCount).toBe(3);
    handle.dispose();
  });

  it('expands beyond three endpoint rows without dropping backend facts', () => {
    const entity = structuredClone(baseline.world.entities[SLICE]!);
    const endpoints = Array.from({ length: 6 }, (_, index) => ({
      address: `192.0.2.${index + 21}`,
      targetRef: `api-object:namespaced:shop:Pod:api-${index + 1}`,
      conditions: {
        ready: index !== 4,
        serving: index !== 4,
        terminating: index === 5,
      },
    }));
    (entity.data as Record<string, unknown>).endpoints = endpoints;

    const handle = new EndpointSliceVisualHandle(entity, baseline.view.entityStates[SLICE]!);
    expect(handle.endpointSlots).toHaveLength(6);
    expect(handle.root.userData.endpointCount).toBe(6);
    expect(handle.root.userData.endpointRowCount).toBe(2);
    expect(handle.root.userData.endpointStates).toHaveLength(6);
    expect(handle.endpointSlots[5]?.userData).toMatchObject({
      address: '192.0.2.26',
      targetRef: 'api-object:namespaced:shop:Pod:api-6',
      terminating: true,
    });
    handle.dispose();
  });

  it('highlights the backend selected by the active route without routing through EndpointSlice', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene);

    registry.sync(requestA.world, requestA.view);
    const sliceA = registry.get(SLICE);
    expect(sliceA).toBeInstanceOf(EndpointSliceVisualHandle);
    expect(sliceA?.root.userData.selectedEndpointTarget).toBe(API_A);
    expect(requestA.view.activeRoutes[0]?.hops.map((hop) => hop.toEntityId)).toEqual([
      SERVICE,
      API_A,
    ]);
    expect(requestA.view.activeRoutes[0]?.hops.some((hop) => hop.toEntityId === SLICE)).toBe(false);

    registry.sync(notReady.world, notReady.view);
    expect(registry.get(SLICE)?.root.userData.selectedEndpointTarget).toBeNull();

    registry.sync(requestC.world, requestC.view);
    expect(registry.get(SLICE)?.root.userData.selectedEndpointTarget).toBe(API_C);
    const selectedRows: THREE.Object3D[] = [];
    registry.get(SLICE)?.root.traverse((object) => {
      if (object.userData.role === 'endpoint-selected-outline' && object.visible) {
        selectedRows.push(object);
      }
    });
    expect(selectedRows).toHaveLength(1);
    registry.clear();
  });

  it('uses a stable left-to-right traffic layout and does not move objects on readiness updates', () => {
    const before = calculateLayout({ world: baseline.world, view: baseline.view });
    const after = calculateLayout({
      world: notReady.world,
      view: notReady.view,
      previous: before,
    });
    expect(before.entities.get(CLIENT)?.position[0]).toBeLessThan(
      before.entities.get(SERVICE)?.position[0] ?? Number.NEGATIVE_INFINITY,
    );
    expect(before.entities.get(SERVICE)?.position[0]).toBeLessThan(
      before.entities.get(API_C)?.position[0] ?? Number.NEGATIVE_INFINITY,
    );
    expect(before.entities.get(SLICE)?.position[2]).not.toBe(
      before.entities.get(SERVICE)?.position[2],
    );
    for (const id of [CLIENT, SERVICE, SLICE, API_A, API_C]) {
      expect(after.entities.get(id)?.position).toEqual(before.entities.get(id)?.position);
    }
    expect(before.containers.map((container) => container.label)).toEqual([
      'CLIENT',
      'STABLE ENTRY / ENDPOINT STATE',
      'BACKEND PODS',
    ]);
  });
});
