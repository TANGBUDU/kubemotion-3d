import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState } from '../../src/course/types';
import { dimensions } from '../../src/renderer/design/dimensions';
import { ContainerVisualHandle } from '../../src/renderer/visuals/ContainerVisual';
import { PodVisualHandle } from '../../src/renderer/visuals/PodVisual';
import type { LocalizedText, WorldEntity } from '../../src/world/types';

const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });
const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };
const focused: EntityViewState = { ...normal, emphasis: 'focused' };

const makePod = (uid = '12345678-aaaa-bbbb-cccc-0123456789ab'): WorldEntity => ({
  id: 'pod:anatomy',
  category: 'api-object',
  kind: 'Pod',
  name: 'anatomy-pod',
  namespace: 'shop',
  status: 'running',
  data: {
    uid,
    nodeName: 'worker-a',
    phase: 'Running',
    restartPolicy: 'Always',
    conditions: {
      podScheduled: true,
      initialized: true,
      containersReady: true,
      ready: true,
    },
  },
  title: text('Pod'),
  summary: text('Pod anatomy'),
  sourceIds: ['source'],
  visual: { archetype: 'pod' },
});

const makeContainer = (id: string, podId = 'pod:anatomy', restartCount = 0): WorldEntity => ({
  id,
  category: 'runtime-status',
  kind: 'Container',
  name: id,
  namespace: 'shop',
  status: 'running',
  data: {
    podId,
    name: id,
    image: `example/${id}:v1`,
    containerID: `containerd://${id}-current`,
    restartCount,
    ready: true,
    started: true,
    state: { kind: 'running', startedAt: '2026-08-08T00:00:00Z' },
    ...(restartCount > 0
      ? {
          lastState: {
            kind: 'terminated',
            reason: 'Error',
            exitCode: 1,
            finishedAt: '2026-08-07T23:59:59Z',
            containerID: `containerd://${id}-previous`,
          },
        }
      : {}),
  },
  title: text(id),
  summary: text(id),
  sourceIds: ['source'],
  visual: { archetype: 'container' },
});

const objectsWithRole = (root: THREE.Object3D, role: string): THREE.Object3D[] => {
  const result: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.userData.role === role) result.push(object);
  });
  return result;
};

const expectContained = (outer: THREE.Box3, inner: THREE.Box3): void => {
  const epsilon = 1e-5;
  expect(inner.min.x).toBeGreaterThanOrEqual(outer.min.x - epsilon);
  expect(inner.min.y).toBeGreaterThanOrEqual(outer.min.y - epsilon);
  expect(inner.min.z).toBeGreaterThanOrEqual(outer.min.z - epsilon);
  expect(inner.max.x).toBeLessThanOrEqual(outer.max.x + epsilon);
  expect(inner.max.y).toBeLessThanOrEqual(outer.max.y + epsilon);
  expect(inner.max.z).toBeLessThanOrEqual(outer.max.z + epsilon);
};

describe('Pod and Container anatomy', () => {
  it('encodes the Pod UID as a stable short fingerprint construct', () => {
    const handle = new PodVisualHandle(makePod(), normal);
    const segments = objectsWithRole(handle.root, 'pod-uid-fingerprint-segment');
    const segmentUuids = segments.map((segment) => segment.uuid);
    const firstPattern = segments.map((segment) => segment.userData.fingerprintValue);

    expect(handle.root.userData.shortUid).toBe('1234\u202689ab');
    expect(handle.root.userData.containerSlotCount).toBe(2);
    expect(handle.root.userData.openTop).toBe(true);
    expect(handle.root.userData.containerSlotAnchors).toEqual([
      [-0.42, 0, 0],
      [0.42, 0, 0],
    ]);
    expect(objectsWithRole(handle.root, 'pod-shell')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'pod-open-header-rail')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'pod-container-slot')).toHaveLength(2);
    expect(segments).toHaveLength(8);

    handle.update(makePod('abcd5678-aaaa-bbbb-cccc-fedcba987654'), normal);
    const updatedSegments = objectsWithRole(handle.root, 'pod-uid-fingerprint-segment');
    expect(handle.root.userData.shortUid).toBe('abcd\u20267654');
    expect(updatedSegments.map((segment) => segment.uuid)).toEqual(segmentUuids);
    expect(updatedSegments.map((segment) => segment.userData.fingerprintValue)).not.toEqual(
      firstPattern,
    );
    handle.dispose();
  });

  it('assigns two focused Containers to deterministic slots fully inside the Pod shell', () => {
    const podHandle = new PodVisualHandle(makePod(), normal);
    const rightFirst = new ContainerVisualHandle(makeContainer('container:z'), focused);
    const leftSecond = new ContainerVisualHandle(makeContainer('container:a'), focused);

    podHandle.attachContainer(rightFirst);
    podHandle.root.updateWorldMatrix(true, true);
    const shellBounds = new THREE.Box3().setFromObject(podHandle.shell, true);
    expect(rightFirst.root.userData.containerSlotIndex).toBe(0);
    expect(rightFirst.root.position.toArray()).toEqual([-0.42, 0, 0]);
    expectContained(shellBounds, rightFirst.getWorldBounds());

    podHandle.attachContainer(leftSecond);
    podHandle.root.updateWorldMatrix(true, true);

    expect(leftSecond.root.userData.containerSlotIndex).toBe(0);
    expect(leftSecond.root.userData.containerSlotAnchor).toEqual([-0.42, 0, 0]);
    expect(leftSecond.root.position.toArray()).toEqual([-0.42, 0, 0]);
    expect(rightFirst.root.userData.containerSlotIndex).toBe(1);
    expect(rightFirst.root.userData.containerSlotAnchor).toEqual([0.42, 0, 0]);
    expect(rightFirst.root.position.toArray()).toEqual([0.42, 0, 0]);
    expect(leftSecond.root.scale.x).toBeCloseTo(1.16);
    expect(rightFirst.root.scale.x).toBeCloseTo(1.16);

    const leftBounds = leftSecond.getWorldBounds();
    const rightBounds = rightFirst.getWorldBounds();
    expectContained(shellBounds, leftBounds);
    expectContained(shellBounds, rightBounds);
    expect(leftBounds.intersectsBox(rightBounds)).toBe(false);

    podHandle.dispose();
    leftSecond.dispose();
    rightFirst.dispose();
  });

  it('keeps the complete focused Pod visual inside a physical Node bay', () => {
    const podHandle = new PodVisualHandle(makePod(), focused);
    const containerHandle = new ContainerVisualHandle(makeContainer('container:api'), normal);
    podHandle.attachContainer(containerHandle);
    podHandle.root.updateWorldMatrix(true, true);

    const bounds = podHandle.getWorldBounds();
    const bay = new THREE.Box3(
      new THREE.Vector3(-dimensions.node.bayWidth / 2, -Infinity, -dimensions.node.bayDepth / 2),
      new THREE.Vector3(dimensions.node.bayWidth / 2, Infinity, dimensions.node.bayDepth / 2),
    );
    expectContained(bay, bounds);
    expect(dimensions.node.bayWidth - (bounds.max.x - bounds.min.x)).toBeGreaterThan(0.1);
    expect(dimensions.node.bayDepth - (bounds.max.z - bounds.min.z)).toBeGreaterThan(0.1);

    podHandle.dispose();
    containerHandle.dispose();
  });

  it('fails fast before a third Container can mutate the two-slot Pod', () => {
    const podHandle = new PodVisualHandle(makePod(), normal);
    const first = new ContainerVisualHandle(makeContainer('container:a'), normal);
    const second = new ContainerVisualHandle(makeContainer('container:b'), normal);
    const third = new ContainerVisualHandle(makeContainer('container:c'), normal);
    podHandle.attachContainer(first);
    podHandle.attachContainer(second);

    expect(() => podHandle.attachContainer(third)).toThrow(
      'Pod "pod:anatomy" supports 2 container slots; cannot attach Container "container:c".',
    );
    expect(podHandle.root.userData.containerCount).toBe(2);
    expect(third.root.parent).toBeNull();

    podHandle.dispose();
    first.dispose();
    second.dispose();
    third.dispose();
  });

  it('shows the aggregate restart badge only while restartCount is positive', () => {
    const podHandle = new PodVisualHandle(makePod(), normal);
    const containerHandle = new ContainerVisualHandle(makeContainer('container:api'), normal);
    podHandle.attachContainer(containerHandle);
    const [badge] = objectsWithRole(podHandle.root, 'pod-restart-badge');

    expect(podHandle.root.userData.restartCount).toBe(0);
    expect(podHandle.root.userData.restartBadgeVisible).toBe(false);
    expect(badge?.visible).toBe(false);

    containerHandle.update(makeContainer('container:api', 'pod:anatomy', 3), normal);
    expect(podHandle.root.userData.restartCount).toBe(3);
    expect(podHandle.root.userData.restartBadgeVisible).toBe(true);
    expect(badge?.visible).toBe(true);
    expect(badge?.userData.restartCount).toBe(3);

    containerHandle.update(makeContainer('container:api'), normal);
    expect(podHandle.root.userData.restartCount).toBe(0);
    expect(podHandle.root.userData.restartBadgeVisible).toBe(false);
    expect(badge?.visible).toBe(false);

    podHandle.dispose();
    containerHandle.dispose();
  });

  it('distinguishes running, waiting, successful completion, and failed termination', () => {
    const runningEntity = makeContainer('container:state');
    const handle = new ContainerVisualHandle(runningEntity, normal);
    const runningMarker = objectsWithRole(handle.root, 'container-state-indicator')[0];
    const waitingMarker = objectsWithRole(handle.root, 'container-waiting-indicator')[0];
    const failureStripe = objectsWithRole(handle.root, 'container-failure-stripe')[0];

    expect(handle.root.userData.stateShape).toBe('solid-dot');
    expect(runningMarker?.visible).toBe(true);
    expect(waitingMarker?.visible).toBe(false);
    expect(failureStripe?.visible).toBe(false);

    const waitingEntity: WorldEntity = {
      ...runningEntity,
      status: 'waiting',
      data: {
        podId: 'pod:anatomy',
        name: 'container:state',
        image: 'example/container:state:v1',
        restartCount: 0,
        ready: false,
        started: false,
        state: { kind: 'waiting', reason: 'ContainerCreating' },
      },
    };
    handle.update(waitingEntity, normal);
    expect(handle.root.userData.stateShape).toBe('open-ring');
    expect(runningMarker?.visible).toBe(false);
    expect(waitingMarker?.visible).toBe(true);
    expect(failureStripe?.visible).toBe(false);

    const terminatedEntity: WorldEntity = {
      ...runningEntity,
      status: 'terminated',
      data: {
        podId: 'pod:anatomy',
        name: 'container:state',
        image: 'example/container:state:v1',
        containerID: 'containerd://container:state-current',
        restartCount: 0,
        ready: false,
        started: false,
        state: {
          kind: 'terminated',
          reason: 'Completed',
          exitCode: 0,
          finishedAt: '2026-08-08T00:00:01Z',
          containerID: 'containerd://container:state-current',
        },
      },
    };
    handle.update(terminatedEntity, normal);
    expect(handle.root.userData.stateShape).toBe('success-dot');
    expect(handle.root.userData.stateForm).toBe('completed');
    expect(handle.root.userData.statusText).toBe('COMPLETED');
    expect(handle.root.userData.terminationOutcome).toBe('completed');
    expect(runningMarker?.visible).toBe(true);
    expect(waitingMarker?.visible).toBe(false);
    expect(failureStripe?.visible).toBe(false);

    const failedEntity: WorldEntity = {
      ...terminatedEntity,
      data: {
        ...terminatedEntity.data,
        state: {
          kind: 'terminated',
          reason: 'Error',
          exitCode: 1,
          finishedAt: '2026-08-08T00:00:02Z',
          containerID: 'containerd://container:state-current',
        },
      },
    };
    handle.update(failedEntity, normal);
    expect(handle.root.userData.stateShape).toBe('failure-stripe');
    expect(handle.root.userData.stateForm).toBe('collapsed');
    expect(handle.root.userData.statusText).toBe('TERMINATED');
    expect(handle.root.userData.terminationOutcome).toBe('failed');
    expect(runningMarker?.visible).toBe(false);
    expect(waitingMarker?.visible).toBe(false);
    expect(failureStripe?.visible).toBe(true);
    handle.dispose();
  });
});
