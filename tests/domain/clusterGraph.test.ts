import { describe, expect, it } from 'vitest';
import { scenario } from '../../src/content/loader';
import { createClusterGraph } from '../../src/domain/clusterGraph';

describe('createClusterGraph', () => {
  it('builds normalized indexes', () => {
    const graph = createClusterGraph(scenario);
    expect(graph.entityById.size).toBe(34);
    expect(graph.entitiesByKind.get('Pod')).toHaveLength(6);
    expect(graph.entitiesByNamespace.get('shop')).toHaveLength(16);
    expect(graph.entitiesByNode.get('worker-a')?.map((entity) => entity.kind)).toContain('Pod');
  });

  it('rejects duplicate entity IDs', () => {
    const copy = structuredClone(scenario);
    const first = copy.entities[0];
    expect(first).toBeDefined();
    if (first) copy.entities.push(structuredClone(first));
    expect(() => createClusterGraph(copy)).toThrow(/Duplicate entity ID/);
  });

  it('rejects invalid relation targets', () => {
    const copy = structuredClone(scenario);
    const relation = copy.relations[0];
    expect(relation).toBeDefined();
    if (relation) relation.to = 'api-object:namespaced:shop:Pod:missing' as typeof relation.to;
    expect(() => createClusterGraph(copy)).toThrow(/missing entity/);
  });

  it('keeps Namespace and Node as orthogonal indexes', () => {
    const graph = createClusterGraph(scenario);
    expect(graph.entitiesByNamespace.get('shop')?.some((entity) => entity.kind === 'Node')).toBe(
      false,
    );
    const pod = graph.entitiesByKind.get('Pod')?.[0];
    expect(pod?.namespace).toBe('shop');
    expect(pod?.nodeName).toMatch(/^worker-/);
  });
});
