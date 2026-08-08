import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { EntityViewState } from '../../src/course/types';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';
import { DeveloperVisualHandle } from '../../src/renderer/visuals/DeveloperVisual';
import { ExternalClientVisualHandle } from '../../src/renderer/visuals/ExternalClientVisual';
import { PodVisualHandle } from '../../src/renderer/visuals/PodVisual';
import type { LocalizedText, WorldEntity } from '../../src/world/types';

const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });
const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };

const externalActor = (
  kind: 'Browser' | 'ExternalClient' | 'Developer',
  data: Readonly<Record<string, unknown>> = {},
): WorldEntity => ({
  id: `external:external:global:${kind}:actor`,
  category: 'external',
  kind,
  name: kind === 'Developer' ? 'platform-engineer' : 'shop-user',
  status: 'healthy',
  data,
  title: text(kind),
  summary: text(`${kind} actor`),
  sourceIds: ['source'],
  visual: { archetype: 'external', size: 'md' },
});

function roles(root: THREE.Object3D): string[] {
  const result: string[] = [];
  root.traverse((object) => {
    if (typeof object.userData.role === 'string') result.push(object.userData.role);
  });
  return result;
}

function ownedResources(root: THREE.Object3D): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) materials.add(material);
  });
  return { geometries, materials };
}

describe('External actor visuals', () => {
  it('uses unique browser-terminal and developer-CLI silhouettes with no Pod anatomy', () => {
    const registry = new VisualFactoryRegistry();
    const browser = registry.create(
      externalActor('Browser', { url: 'https://shop.example.test' }),
      normal,
      { allowGeneric: false },
    );
    const developer = registry.create(
      externalActor('Developer', { command: 'kubectl apply -f app.yaml' }),
      normal,
      { allowGeneric: false },
    );

    expect(browser).toBeInstanceOf(ExternalClientVisualHandle);
    expect(developer).toBeInstanceOf(DeveloperVisualHandle);
    expect(browser).not.toBeInstanceOf(PodVisualHandle);
    expect(developer).not.toBeInstanceOf(PodVisualHandle);
    expect(browser.root.userData).toMatchObject({
      visualKind: 'external-client-browser-terminal',
      externalActor: true,
      outsideCluster: true,
      actorType: 'browser',
      address: 'https://shop.example.test',
    });
    expect(developer.root.userData).toMatchObject({
      visualKind: 'developer-cli-station',
      externalActor: true,
      outsideCluster: true,
      actorType: 'developer',
      command: 'kubectl apply -f app.yaml',
      apiTarget: 'kube-apiserver',
    });
    expect(browser.root.userData.visualKind).not.toBe(developer.root.userData.visualKind);

    const browserRoles = roles(browser.root);
    const developerRoles = roles(developer.root);
    expect(browserRoles).toEqual(
      expect.arrayContaining([
        'external-client-terminal-base',
        'external-client-browser-frame',
        'external-client-browser-screen',
        'external-client-address-rail',
        'external-client-request-port',
      ]),
    );
    expect(developerRoles).toEqual(
      expect.arrayContaining([
        'developer-station-base',
        'developer-terminal',
        'developer-cli-screen',
        'developer-prompt',
        'developer-api-port',
      ]),
    );
    for (const actorRoles of [browserRoles, developerRoles]) {
      expect(actorRoles).not.toContain('pod-shell');
      expect(actorRoles).not.toContain('pod-container-slot');
      expect(actorRoles).not.toContain('container-slot');
    }

    browser.dispose();
    developer.dispose();
  });

  it('updates status and actor evidence in place', () => {
    const browserEntity = externalActor('ExternalClient', {
      requestUrl: 'https://shop.example.test/catalog',
      requestTarget: 'shop-web',
    });
    const developerEntity = externalActor('Developer', {
      command: 'kubectl get pods',
      apiTarget: 'api-a',
    });
    const browser = new ExternalClientVisualHandle(browserEntity, normal);
    const developer = new DeveloperVisualHandle(developerEntity, normal);
    const browserObjects = roles(browser.root).map((role, index) => `${role}:${index}`);
    const developerObjects = roles(developer.root).map((role, index) => `${role}:${index}`);
    const browserUuids: string[] = [];
    const developerUuids: string[] = [];
    browser.root.traverse((object) => browserUuids.push(object.uuid));
    developer.root.traverse((object) => developerUuids.push(object.uuid));

    browser.update(
      {
        ...browserEntity,
        status: 'failed',
        data: { requestUrl: 'https://shop.example.test/checkout', requestTarget: 'checkout' },
      },
      normal,
    );
    developer.update(
      {
        ...developerEntity,
        status: 'failed',
        data: { command: 'kubectl apply -f rollout.yaml', apiTarget: 'kube-apiserver' },
      },
      normal,
    );

    const updatedBrowserUuids: string[] = [];
    const updatedDeveloperUuids: string[] = [];
    browser.root.traverse((object) => updatedBrowserUuids.push(object.uuid));
    developer.root.traverse((object) => updatedDeveloperUuids.push(object.uuid));
    expect(updatedBrowserUuids).toEqual(browserUuids);
    expect(updatedDeveloperUuids).toEqual(developerUuids);
    expect(roles(browser.root).map((role, index) => `${role}:${index}`)).toEqual(browserObjects);
    expect(roles(developer.root).map((role, index) => `${role}:${index}`)).toEqual(
      developerObjects,
    );
    expect(browser.root.userData).toMatchObject({
      actorType: 'external-client',
      address: 'https://shop.example.test/checkout',
      requestTarget: 'checkout',
      statusText: 'FAILED',
    });
    expect(developer.root.userData).toMatchObject({
      command: 'kubectl apply -f rollout.yaml',
      apiTarget: 'kube-apiserver',
      statusText: 'FAILED',
    });

    browser.dispose();
    developer.dispose();
  });

  it('disposes every owned geometry and material exactly once', () => {
    const handles = [
      new ExternalClientVisualHandle(externalActor('Browser'), normal),
      new DeveloperVisualHandle(externalActor('Developer'), normal),
    ];

    for (const handle of handles) {
      const resources = ownedResources(handle.root);
      const disposalSpies = [
        ...[...resources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
        ...[...resources.materials].map((material) => vi.spyOn(material, 'dispose')),
      ];
      handle.dispose();
      handle.dispose();

      expect(handle.isDisposed).toBe(true);
      expect(handle.root.children).toHaveLength(0);
      expect(handle.root.userData.activeWorld).toBe(false);
      expect(disposalSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    }
  });
});
