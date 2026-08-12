import { describe, expect, it } from 'vitest';
import { scenario } from '../../src/content/loader';
import { createExploreProjection } from '../../src/course/exploreProjection';
import type { ViewMode, ViewProjection } from '../../src/course/types';
import { calculateLayout, type EntityLayout } from '../../src/renderer/LayoutEngine';
import type { EntityId, WorldEntity, WorldRelation } from '../../src/world/types';

const NAMESPACE = 'api-object:cluster:global:Namespace:shop';
const DEPLOYMENT = 'api-object:namespaced:shop:Deployment:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';

const OWNERSHIP_RELATIONS = [
  'api-deployment-owns-api-replicaset',
  'owns-api-a-old',
  'owns-api-b',
  'owns-api-c',
] as const;
const SCOPE_RELATION = 'api-deployment-scoped-by-shop';

const emptyFilters = Object.freeze({ query: '', kind: '', namespace: '', status: '' });

const projectionFor = (view: ViewMode): ViewProjection =>
  createExploreProjection(scenario, view, emptyFilters);

const visibleEntities = (projection: ViewProjection): readonly WorldEntity[] =>
  Object.values(scenario.entities).filter(
    (entity) => projection.entityStates[entity.id]?.visible === true,
  );

const visibleRelations = (projection: ViewProjection): readonly WorldRelation[] =>
  Object.values(scenario.relations).filter(
    (relation) => projection.relationStates[relation.id]?.visible === true,
  );

const requireLayout = (
  layouts: ReadonlyMap<EntityId, EntityLayout>,
  entityId: EntityId,
): EntityLayout => {
  const layout = layouts.get(entityId);
  if (!layout) throw new Error(`Missing layout for ${entityId}`);
  return layout;
};

describe('verified logical ownership and physical placement layouts', () => {
  it('renders Namespace -> Deployment -> ReplicaSet -> Pods without Node containment', () => {
    expect(scenario.schemaVersion).toBe(2);
    expect(scenario.scenarioId).toBe('container-restart-golden');

    const projection = projectionFor('logical');
    const visible = visibleEntities(projection);
    const byKind = (kind: string): readonly WorldEntity[] =>
      visible.filter((entity) => entity.kind === kind);

    expect(byKind('Namespace')).toHaveLength(1);
    expect(byKind('Deployment')).toHaveLength(1);
    expect(byKind('ReplicaSet')).toHaveLength(1);
    expect(byKind('Pod')).toHaveLength(3);
    expect(byKind('Node')).toHaveLength(0);
    expect(new Set(visible.map((entity) => entity.kind))).toEqual(
      new Set(['Namespace', 'Deployment', 'ReplicaSet', 'Pod']),
    );

    const layout = calculateLayout({ world: scenario, view: projection });
    const namespaceLayout = requireLayout(layout.entities, NAMESPACE);
    const deploymentLayout = requireLayout(layout.entities, DEPLOYMENT);
    const replicaSetLayout = requireLayout(layout.entities, REPLICA_SET);
    const podLayouts = byKind('Pod').map((pod) => requireLayout(layout.entities, pod.id));

    expect(namespaceLayout.containerId).toBe('namespace-workspace');
    expect(deploymentLayout.containerId).toBe('namespace-workspace');
    expect(replicaSetLayout.containerId).toBe('namespace-workspace');
    expect(deploymentLayout.position[0]).toBeLessThan(replicaSetLayout.position[0]);
    expect(podLayouts.every((pod) => replicaSetLayout.position[0] < pod.position[0])).toBe(true);
    for (const podLayout of podLayouts) {
      expect(podLayout.containerId).toBe('namespace-workspace');
      expect(podLayout.lane).toBe('semantic');
      expect(podLayout.lane).not.toBe('pod-slot');
      expect(podLayout.parentId).toBeUndefined();
    }

    const expectedRelations = [SCOPE_RELATION, ...OWNERSHIP_RELATIONS];
    for (const relationId of expectedRelations) {
      expect(projection.relationStates[relationId]?.visible).toBe(true);
      expect(layout.routes.has(relationId)).toBe(true);
    }
    expect(new Set(visibleRelations(projection).map((relation) => relation.semantic))).toEqual(
      new Set(['ownership', 'scope']),
    );
  });

  it('keeps logical controllers hidden while preserving Node -> Pod placement', () => {
    const projection = projectionFor('placement');
    const visible = visibleEntities(projection);
    const byKind = (kind: string): readonly WorldEntity[] =>
      visible.filter((entity) => entity.kind === kind);

    expect(byKind('Namespace')).toHaveLength(0);
    expect(byKind('Deployment')).toHaveLength(0);
    expect(byKind('ReplicaSet')).toHaveLength(0);
    expect(byKind('Node')).toHaveLength(3);
    expect(byKind('Pod')).toHaveLength(3);

    const layout = calculateLayout({ world: scenario, view: projection });
    const visibleNodeIds = new Set(byKind('Node').map((node) => node.id));
    for (const pod of byKind('Pod')) {
      const podLayout = requireLayout(layout.entities, pod.id);
      const placement = Object.values(scenario.relations).find(
        (relation) => relation.semantic === 'placement' && relation.from === pod.id,
      );
      if (!placement) throw new Error(`Missing placement relation for ${pod.id}`);

      expect(podLayout.lane).toBe('pod-slot');
      expect(podLayout.parentId).toBe(placement.to);
      expect(visibleNodeIds.has(placement.to)).toBe(true);
      expect(projection.relationStates[placement.id]?.visible).toBe(true);
      expect(layout.routes.has(placement.id)).toBe(true);
    }

    expect(layout.entities.has(NAMESPACE)).toBe(false);
    expect(layout.entities.has(DEPLOYMENT)).toBe(false);
    expect(layout.entities.has(REPLICA_SET)).toBe(false);
    expect(projection.relationStates[SCOPE_RELATION]?.visible).toBe(false);
    for (const relationId of OWNERSHIP_RELATIONS) {
      expect(projection.relationStates[relationId]?.visible).toBe(false);
    }
  });
});
