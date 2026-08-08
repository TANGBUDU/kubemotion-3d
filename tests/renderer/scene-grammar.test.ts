import { describe, expect, it } from 'vitest';
import { scenario, scenarioById } from '../../src/content/loader';
import { createExploreProjection } from '../../src/course/exploreProjection';
import type { EntityViewState, RelationViewState, ViewProjection } from '../../src/course/types';
import { SCENE_GRAMMARS, createEffectiveScenePlan } from '../../src/renderer/scene-grammar';
import type { EntityId, RelationId, WorldSnapshot } from '../../src/world/types';

const traffic = scenarioById.get('service-routes-to-pods');
if (!traffic) throw new Error('Scene grammar fixtures are missing');

function fullyVisibleProjection(
  world: WorldSnapshot,
  view: ViewProjection['view'],
): ViewProjection {
  return {
    view,
    cameraPresetId: view,
    entityStates: Object.fromEntries(
      Object.values(world.entities).map((entity) => [
        entity.id,
        {
          visible: true,
          emphasis: 'focused',
          labelMode: 'full',
        } satisfies EntityViewState,
      ]),
    ) as Record<EntityId, EntityViewState>,
    relationStates: Object.fromEntries(
      Object.values(world.relations).map((relation) => [
        relation.id,
        { visible: true, emphasis: 'focused' } satisfies RelationViewState,
      ]),
    ) as Record<RelationId, RelationViewState>,
    callouts: [],
    activeRoutes: [],
  };
}

describe('foundation-first scene grammars', () => {
  it('defines six independent contracts with directive density ceilings', () => {
    expect(Object.keys(SCENE_GRAMMARS).sort()).toEqual([
      'control-flow',
      'logical',
      'overview',
      'placement',
      'storage',
      'traffic',
    ]);
    expect(
      new Set(Object.values(SCENE_GRAMMARS).map((grammar) => grammar.layoutAlgorithm)).size,
    ).toBe(6);
    for (const grammar of Object.values(SCENE_GRAMMARS)) {
      expect(grammar.budgets.desktop.maxPrimaryEntities).toBeLessThanOrEqual(12);
      expect(grammar.budgets.desktop.maxSecondaryEntities).toBeLessThanOrEqual(8);
      expect(grammar.budgets.desktop.maxEntityLabels).toBeLessThanOrEqual(7);
      expect(grammar.budgets.desktop.maxRelationLabels).toBeLessThanOrEqual(3);
      expect(grammar.budgets.desktop.maxFocusedEntities).toBeLessThanOrEqual(3);
      expect(grammar.budgets.desktop.maxAnimatedTokens).toBeLessThanOrEqual(6);
      expect(grammar.budgets.desktop.maxRelationFamilies).toBeLessThanOrEqual(2);
      expect(grammar.budgets.mobile.maxPrimaryEntities).toBeLessThanOrEqual(7);
      expect(grammar.budgets.mobile.maxEntityLabels).toBeLessThanOrEqual(3);
      expect(grammar.budgets.mobile.maxFocusedEntities).toBeLessThanOrEqual(2);
      expect(grammar.budgets.mobile.maxRelationLabels).toBeLessThanOrEqual(1);
    }
    expect(SCENE_GRAMMARS.overview.budgets.desktop).toMatchObject({
      maxPrimaryEntities: 9,
      maxSecondaryEntities: 4,
      maxRelationLabels: 1,
      maxFocusedEntities: 2,
      maxAnimatedTokens: 2,
    });
    expect(SCENE_GRAMMARS.traffic.budgets.desktop).toMatchObject({
      maxPrimaryEntities: 5,
      maxSecondaryEntities: 5,
      maxRelationLabels: 2,
      maxAnimatedTokens: 6,
    });
  });

  it('makes unfiltered Explore Overview a bounded cluster summary rather than focus-all', () => {
    const projection = createExploreProjection(scenario, 'overview', {
      query: '',
      kind: '',
      namespace: '',
      status: '',
    });
    const visible = Object.values(scenario.entities).filter(
      (entity) => projection.entityStates[entity.id]?.visible,
    );
    expect(visible.filter((entity) => entity.kind === 'Pod').length).toBeGreaterThan(0);
    expect(visible.filter((entity) => entity.kind === 'Pod').length).toBeLessThanOrEqual(4);
    expect(
      visible.every((entity) => SCENE_GRAMMARS.overview.allowedEntityKinds.includes(entity.kind)),
    ).toBe(true);
    expect(
      visible.every((entity) => projection.entityStates[entity.id]?.emphasis === 'normal'),
    ).toBe(true);
    expect(
      visible.filter((entity) => projection.entityStates[entity.id]?.labelMode !== 'none'),
    ).toHaveLength(7);
    expect(visible.some((entity) => projection.entityStates[entity.id]?.labelMode === 'full')).toBe(
      false,
    );
  });

  it('admits a focused filtered match as bounded Explore detail-on-demand', () => {
    const projection = createExploreProjection(traffic, 'overview', {
      query: '',
      kind: 'Service',
      namespace: '',
      status: '',
    });
    const services = Object.values(traffic.entities).filter(
      (entity) => entity.kind === 'Service' && projection.entityStates[entity.id]?.visible,
    );
    expect(services).toHaveLength(1);
    expect(
      services.every((entity) => projection.entityStates[entity.id]?.emphasis === 'focused'),
    ).toBe(true);
  });

  it('applies mobile focus, label, entity, and relation-family budgets deterministically', () => {
    const authored = fullyVisibleProjection(scenario, 'control-flow');
    const first = createEffectiveScenePlan(scenario, authored, { viewport: 'mobile' });
    const second = createEffectiveScenePlan(scenario, authored, { viewport: 'mobile' });
    expect(second.visibleEntityIds).toEqual(first.visibleEntityIds);
    expect(first.primaryEntityIds.length).toBeLessThanOrEqual(7);
    expect(first.secondaryEntityIds.length).toBeLessThanOrEqual(3);
    expect(first.visibleRelationFamilies.length).toBeLessThanOrEqual(2);
    expect(
      Object.values(first.projection.entityStates).filter(
        (state) => state.visible && state.emphasis === 'focused',
      ),
    ).toHaveLength(2);
    expect(
      Object.values(first.projection.entityStates).filter(
        (state) => state.visible && state.labelMode !== 'none',
      ),
    ).toHaveLength(3);
    for (const relation of Object.values(scenario.relations)) {
      if (relation.semantic !== 'composition' && relation.semantic !== 'placement') continue;
      const dependentId = relation.semantic === 'composition' ? relation.to : relation.from;
      const requiredId = relation.semantic === 'composition' ? relation.from : relation.to;
      if (first.projection.entityStates[dependentId]?.visible) {
        expect(first.projection.entityStates[requiredId]?.visible).toBe(true);
      }
    }
  });

  it('keeps EndpointSlice configuration and membership while dropping selector-line clutter', () => {
    const plan = createEffectiveScenePlan(traffic, fullyVisibleProjection(traffic, 'traffic'));
    expect(plan.visibleRelationFamilies).toEqual(['configuration', 'endpoint-membership']);
    expect(plan.visibleRelationIds).toContain('endpoint-slice-for-api-service');
    expect(plan.visibleRelationIds.some((id) => id.startsWith('service-selects-'))).toBe(false);

    const authored = fullyVisibleProjection(traffic, 'traffic');
    const focusedSelection = createEffectiveScenePlan(traffic, {
      ...authored,
      relationStates: Object.fromEntries(
        Object.entries(authored.relationStates).map(([id, state]) => [
          id,
          { ...state, emphasis: id.startsWith('service-selects-') ? 'focused' : 'normal' },
        ]),
      ),
    });
    expect(focusedSelection.visibleRelationFamilies).toEqual(['selection', 'configuration']);
  });

  it('rejects a route whose endpoint kind is outside the selected grammar', () => {
    const authored = fullyVisibleProjection(scenario, 'overview');
    const apiServer = Object.values(scenario.entities).find(
      (entity) => entity.kind === 'KubeAPIServer',
    );
    const replicaSet = Object.values(scenario.entities).find(
      (entity) => entity.kind === 'ReplicaSet',
    );
    if (!apiServer || !replicaSet) throw new Error('Expected route participants are missing');
    expect(() =>
      createEffectiveScenePlan(scenario, {
        ...authored,
        activeRoutes: [
          {
            id: 'invalid-overview-route',
            semantic: 'control',
            persistAfterAnimation: true,
            hops: [
              {
                fromEntityId: apiServer.id,
                fromAnchor: 'control',
                toEntityId: replicaSet.id,
                toAnchor: 'control',
              },
            ],
          },
        ],
      }),
    ).toThrow(/kind "ReplicaSet" is not allowed in overview view/);
  });

  it('admits the kubelet-to-container-runtime hop in Control Flow', () => {
    const kubeletId = 'runtime-component:node:worker-b:Kubelet:kubelet';
    const runtimeId = 'runtime-component:node:worker-b:ContainerRuntime:runtime';
    const authored = fullyVisibleProjection(scenario, 'control-flow');
    const plan = createEffectiveScenePlan(scenario, {
      ...authored,
      entityStates: Object.fromEntries(
        Object.entries(authored.entityStates).map(([id, state]) => [
          id,
          {
            ...state,
            visible: id === kubeletId || id === runtimeId,
            emphasis: id === kubeletId || id === runtimeId ? 'focused' : 'hidden',
          },
        ]),
      ) as Record<EntityId, EntityViewState>,
      relationStates: Object.fromEntries(
        Object.entries(authored.relationStates).map(([id, state]) => [
          id,
          { ...state, visible: false },
        ]),
      ) as Record<RelationId, RelationViewState>,
      activeRoutes: [
        {
          id: 'kubelet-starts-container',
          semantic: 'node-runtime',
          persistAfterAnimation: true,
          hops: [
            {
              fromEntityId: kubeletId,
              fromAnchor: 'control',
              toEntityId: runtimeId,
              toAnchor: 'control',
            },
          ],
        },
      ],
    });
    expect(plan.visibleEntityIds).toContain(runtimeId);
    expect(plan.projection.activeRoutes.flatMap((route) => route.hops)).toContainEqual(
      expect.objectContaining({ toEntityId: runtimeId }),
    );
  });

  it('rejects active-route token demand above the selected grammar budget', () => {
    const authored = fullyVisibleProjection(scenario, 'overview');
    const ids = ['KubeAPIServer', 'ControllerManager', 'Scheduler', 'Node'].map((kind) => {
      const match = Object.values(scenario.entities).find((entity) => entity.kind === kind);
      if (!match) throw new Error(`Expected ${kind} route fixture`);
      return match.id;
    });
    expect(() =>
      createEffectiveScenePlan(scenario, {
        ...authored,
        activeRoutes: ids.slice(1).map(
          (toEntityId, index) =>
            ({
              id: `too-many-overview-tokens-${index + 1}`,
              semantic: 'control',
              persistAfterAnimation: true,
              hops: [
                {
                  fromEntityId: ids[index]!,
                  fromAnchor: 'control',
                  toEntityId,
                  toAnchor: 'control',
                },
              ],
            }) as const,
        ),
      }),
    ).toThrow(/requires 3 route tokens but its budget allows 2/);
  });
});
