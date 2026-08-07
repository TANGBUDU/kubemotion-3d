import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { LayoutResult, Position } from '../../src/renderer/LayoutEngine';
import {
  captureLayoutTransition,
  CapturedLayoutTransition,
} from '../../src/renderer/animation/layoutMotion';
import type { EntityVisualHandle } from '../../src/renderer/VisualHandles';
import type { WorldEntity } from '../../src/world/types';

const POD_ID = 'api-object:namespaced:shop:Pod:api-d-new';
const localized = { en: 'Pod', ja: 'Pod', 'zh-CN': 'Pod' } as const;

const layout = (position: Position): LayoutResult => ({
  entities: new Map([
    [
      POD_ID,
      {
        entityId: POD_ID,
        position,
        lane: 'pending' as const,
        containerId: 'pending-lane',
      },
    ],
  ]),
  positions: new Map([[POD_ID, position]]),
  containers: [],
  routes: new Map(),
});

const podHandle = (): EntityVisualHandle => {
  const root = new THREE.Group();
  root.userData.activeWorld = true;
  const entity: WorldEntity = {
    id: POD_ID,
    category: 'api-object',
    kind: 'Pod',
    name: 'api-d-new',
    namespace: 'shop',
    status: 'pending',
    data: { uid: 'new', phase: 'Pending', restartPolicy: 'Always' },
    title: localized,
    summary: localized,
    sourceIds: [],
    visual: { archetype: 'pod' },
  };
  return {
    entityId: POD_ID,
    entity,
    root,
    selectableObjects: [],
    isDisposed: false,
    update: () => undefined,
    setSelected: () => undefined,
    getAnchor: () => root.position.clone(),
    dispose: () => undefined,
  };
};

describe('captured layout transition', () => {
  it('interpolates an existing Pod from the pending tray to its final Node slot', () => {
    const handle = podHandle();
    const transition = captureLayoutTransition(
      layout([4.6, 0.28, -2.05]),
      layout([7.62, 0.38, 2.03]),
      [POD_ID],
      () => handle,
    );

    expect(transition).toBeInstanceOf(CapturedLayoutTransition);
    expect(transition?.entityIds).toEqual([POD_ID]);
    transition?.apply(0);
    expect(handle.root.position.toArray()).toEqual([4.6, 0.28, -2.05]);
    transition?.apply(0.5);
    expect(handle.root.position.x).toBeCloseTo(6.11);
    expect(handle.root.position.y).toBeCloseTo(0.33);
    expect(handle.root.position.z).toBeCloseTo(-0.01);
    transition?.finish();
    transition?.finish();
    expect(handle.root.position.x).toBeCloseTo(7.62);
    expect(handle.root.position.y).toBeCloseTo(0.38);
    expect(handle.root.position.z).toBeCloseTo(2.03);
  });

  it('does not invent motion for direct navigation without a previous position change', () => {
    const handle = podHandle();
    expect(
      captureLayoutTransition(layout([1, 2, 3]), layout([1, 2, 3]), [POD_ID], () => handle),
    ).toBeUndefined();
  });
});
