import { describe, expect, it } from 'vitest';
import { scenario } from '../../src/content/loader';
import { createExploreProjection } from '../../src/course/exploreProjection';
import { createClusterGraph } from '../../src/domain/clusterGraph';
import { calculateLayout } from '../../src/renderer/LayoutEngine';

const graph = createClusterGraph(scenario);
const filters = { query: '', kind: '', namespace: '', status: '' } as const;

describe('LayoutEngine', () => {
  it('is stable for the same input', () => {
    const projection = createExploreProjection(graph, 'logical', filters);
    expect(calculateLayout(graph, projection)).toEqual(calculateLayout(graph, projection));
  });

  it('places only Pods and node-scoped runtime components by node', () => {
    const projection = createExploreProjection(graph, 'placement', filters);
    const layout = calculateLayout(graph, projection);
    const deployment = graph.entitiesByKind.get('Deployment')?.[0];
    const pod = graph.entitiesByKind.get('Pod')?.[0];
    expect(deployment && layout.positions.get(deployment.id)?.[1]).toBeGreaterThan(3);
    expect(pod && layout.positions.get(pod.id)?.[1]).toBeLessThan(3);
  });
});
