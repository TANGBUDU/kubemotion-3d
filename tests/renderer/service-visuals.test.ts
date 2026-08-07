import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lessonById, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { calculateLayout } from '../../src/renderer/LayoutEngine';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';
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
const rerouted = compiled.steps[4]!;

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
    expect(service.root.userData.domLabel.text).toContain('198.51.100.42:8080');
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

  it('updates endpoint readiness in place and exposes a non-color NotReady mark', () => {
    const handle = new EndpointSliceVisualHandle(
      baseline.world.entities[SLICE]!,
      baseline.view.entityStates[SLICE]!,
    );
    const slotUuids = handle.endpointSlots.map((slot) => slot.uuid);
    handle.update(rerouted.world.entities[SLICE]!, rerouted.view.entityStates[SLICE]!);
    expect(handle.endpointSlots.map((slot) => slot.uuid)).toEqual(slotUuids);
    expect(handle.root.userData.readyEndpointCount).toBe(2);
    expect(handle.endpointSlots[0]?.userData.ready).toBe(false);
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

  it('uses a stable left-to-right traffic layout and does not move objects on readiness updates', () => {
    const before = calculateLayout({ world: baseline.world, view: baseline.view });
    const after = calculateLayout({
      world: rerouted.world,
      view: rerouted.view,
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
