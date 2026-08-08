import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState } from '../../src/course/types';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';
import { dimensions } from '../../src/renderer/design/dimensions';
import { DeploymentVisualHandle } from '../../src/renderer/visuals/DeploymentVisual';
import { NamespaceVisualHandle } from '../../src/renderer/visuals/NamespaceVisual';
import type { LocalizedText, WorldEntity } from '../../src/world/types';

const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };
const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });

const entity = (
  kind: 'Namespace' | 'Deployment',
  name: string,
  data: Readonly<Record<string, unknown>>,
): WorldEntity => ({
  id: `api-object:namespaced:shop:${kind}:${name}`,
  category: 'api-object',
  kind,
  name,
  ...(kind === 'Deployment' ? { namespace: 'shop' } : {}),
  status: 'healthy',
  data,
  title: text(name),
  summary: text(name),
  sourceIds: ['kubernetes-docs'],
  visual: { archetype: kind === 'Namespace' ? 'namespace' : 'deployment' },
});

const objectsWithRole = (root: THREE.Object3D, role: string): THREE.Object3D[] => {
  const result: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.userData.role === role) result.push(object);
  });
  return result;
};

const uuidsByRole = (root: THREE.Object3D, roles: ReadonlySet<string>): string[] => {
  const result: string[] = [];
  root.traverse((object) => {
    if (typeof object.userData.role === 'string' && roles.has(object.userData.role)) {
      result.push(object.uuid);
    }
  });
  return result;
};

describe('M4 logical object visuals', () => {
  it('renders Namespace as a shallow bordered logical workspace rather than a physical host', () => {
    const handle = new VisualFactoryRegistry().create(entity('Namespace', 'shop', {}), normal, {
      allowGeneric: false,
    });

    expect(handle).toBeInstanceOf(NamespaceVisualHandle);
    if (!(handle instanceof NamespaceVisualHandle)) {
      throw new Error('Namespace factory did not return NamespaceVisualHandle');
    }
    expect(handle.root.userData).toMatchObject({
      visualKind: 'namespace-logical-workspace',
      logicalScope: true,
      physicalHost: false,
      workspaceDimensions: {
        width: dimensions.logical.namespaceWorkspace.width,
        depth: dimensions.logical.namespaceWorkspace.depth,
      },
    });
    expect(objectsWithRole(handle.root, 'namespace-workspace-surface')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'namespace-boundary-rail')).toHaveLength(4);
    expect(objectsWithRole(handle.root, 'namespace-title-dock')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'namespace-scope-corner')).toHaveLength(4);

    const size = handle.getWorldBounds().getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(dimensions.logical.namespaceWorkspace.width, 4);
    expect(size.z).toBeCloseTo(dimensions.logical.namespaceWorkspace.depth, 4);
    expect(size.y).toBeLessThan(0.3);
    expect(handle.root.userData.shortLabel).toBe('Namespace · shop');
    handle.dispose();
  });

  it('renders a data-bearing Deployment blueprint and updates every mesh in place', () => {
    const original = entity('Deployment', 'api', {
      desiredReplicas: 3,
      strategy: 'RollingUpdate',
      revision: 7,
      version: 'v2',
    });
    const handle = new VisualFactoryRegistry().create(original, normal, { allowGeneric: false });
    expect(handle).toBeInstanceOf(DeploymentVisualHandle);
    if (!(handle instanceof DeploymentVisualHandle)) {
      throw new Error('Deployment factory did not return DeploymentVisualHandle');
    }
    const stableRoles = new Set([
      'deployment-blueprint-board',
      'deployment-blueprint-grid',
      'deployment-strategy-badge',
      'deployment-version-badge',
      'deployment-declared-replica-slot',
      'deployment-rollout-arrow',
      'deployment-rollout-arrow-stem',
      'deployment-rollout-arrow-head',
    ]);
    const initialUuids = uuidsByRole(handle.root, stableRoles);

    expect(objectsWithRole(handle.root, 'deployment-blueprint-board')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'deployment-blueprint-grid')).toHaveLength(8);
    expect(objectsWithRole(handle.root, 'deployment-strategy-badge')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'deployment-version-badge')).toHaveLength(1);
    expect(objectsWithRole(handle.root, 'deployment-declared-replica-slot')).toHaveLength(6);
    expect(objectsWithRole(handle.root, 'deployment-rollout-arrow')).toHaveLength(1);
    expect(handle.root.userData).toMatchObject({
      visualKind: 'deployment-blueprint',
      configurationObject: true,
      runtimeInstance: false,
      desiredReplicas: 3,
      visibleReplicaSlots: 3,
      strategy: 'RollingUpdate',
      revision: '7',
      version: 'v2',
    });
    expect(
      objectsWithRole(handle.root, 'deployment-declared-replica-slot').filter(
        (slot) => slot.visible,
      ),
    ).toHaveLength(3);

    const updated: WorldEntity = {
      ...original,
      data: {
        desiredReplicas: 5,
        strategy: { type: 'Recreate' },
        revision: '8',
        version: 'v3',
      },
    };
    handle.update(updated, normal);

    expect(uuidsByRole(handle.root, stableRoles)).toEqual(initialUuids);
    expect(
      objectsWithRole(handle.root, 'deployment-declared-replica-slot').filter(
        (slot) => slot.visible,
      ),
    ).toHaveLength(5);
    expect(handle.root.userData).toMatchObject({
      desiredReplicas: 5,
      visibleReplicaSlots: 5,
      replicaOverflow: 0,
      strategy: 'Recreate',
      revision: '8',
      version: 'v3',
    });
    expect(objectsWithRole(handle.root, 'deployment-strategy-badge')[0]?.userData.text).toBe(
      'Recreate',
    );
    expect(objectsWithRole(handle.root, 'deployment-version-badge')[0]?.userData).toMatchObject({
      text: 'v3',
      revision: '8',
    });
    expect(objectsWithRole(handle.root, 'deployment-rollout-arrow')[0]?.userData).toMatchObject({
      strategy: 'Recreate',
      revision: '8',
    });
    handle.dispose();
  });
});
