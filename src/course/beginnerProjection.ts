import type {
  CompiledStep,
  EntityViewState,
  RelationViewState,
  TransitionCue,
  ViewMode,
} from './types';
import type { EntityId, RelationId, WorldEntity, WorldRelation } from '../world/types';

const CONTEXT_RELATION_LIMIT: Readonly<Record<ViewMode, number>> = {
  overview: 0,
  logical: 2,
  placement: 1,
  'control-flow': 1,
  traffic: 1,
  storage: 1,
};

const relationScore = (relation: WorldRelation, state: RelationViewState): number => {
  const emphasis = state.emphasis === 'focused' ? 200 : state.emphasis === 'normal' ? 100 : 20;
  const semantic =
    relation.semantic === 'ownership'
      ? 60
      : relation.semantic === 'placement'
        ? 55
        : relation.semantic === 'endpoint-membership'
          ? 50
          : relation.semantic === 'control-observation'
            ? 45
            : 20;
  return emphasis + semantic;
};

const focusedEntityId = (step: CompiledStep): EntityId | undefined =>
  Object.entries(step.view.entityStates).find(
    ([, state]) =>
      state.visible && (state.inspectorMode === 'expanded' || state.emphasis === 'focused'),
  )?.[0];

const routeEntityIds = (step: CompiledStep): Set<EntityId> => {
  const ids = new Set<EntityId>();
  for (const route of step.view.activeRoutes) {
    for (const hop of route.hops) {
      ids.add(hop.fromEntityId);
      ids.add(hop.toEntityId);
    }
    if (route.support) {
      ids.add(route.support.serviceId);
      ids.add(route.support.endpointSliceId);
      ids.add(route.support.selectedEndpointTargetId);
    }
  }
  return ids;
};

const kindPriorityForView = (view: ViewMode, entity: WorldEntity): number => {
  const orders: Readonly<Record<ViewMode, readonly string[]>> = {
    overview: ['Cluster', 'KubeAPIServer', 'Etcd', 'ControllerManager', 'Scheduler', 'Node', 'Pod'],
    logical: ['Deployment', 'ReplicaSet', 'Pod', 'Namespace'],
    placement: ['Node', 'Pod', 'Container', 'Kubelet', 'ContainerRuntime'],
    'control-flow': [
      'KubeAPIServer',
      'ControllerManager',
      'Scheduler',
      'Kubelet',
      'ContainerRuntime',
      'Pod',
      'ReplicaSet',
    ],
    traffic: ['Browser', 'ClientPod', 'Service', 'GatewayDataPlane', 'Pod', 'EndpointSlice'],
    storage: ['Pod', 'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass'],
  };
  const index = orders[view].indexOf(entity.kind);
  return index === -1 ? 0 : orders[view].length - index;
};

const semanticContextIds = (step: CompiledStep, focusId: EntityId | undefined): Set<EntityId> => {
  const ids = new Set<EntityId>();
  if (focusId) ids.add(focusId);
  const visibleEntities = Object.values(step.world.entities)
    .filter((entity) => step.view.entityStates[entity.id]?.visible)
    .sort(
      (left, right) =>
        kindPriorityForView(step.view.view, right) - kindPriorityForView(step.view.view, left) ||
        left.id.localeCompare(right.id),
    );

  const maximum = step.view.view === 'placement' ? 4 : step.view.view === 'control-flow' ? 4 : 5;
  for (const entity of visibleEntities) {
    if (ids.size >= maximum) break;
    const priority = kindPriorityForView(step.view.view, entity);
    if (priority > 0) ids.add(entity.id);
  }
  return ids;
};

const simplifiedRelations = (
  step: CompiledStep,
): Readonly<Record<RelationId, RelationViewState>> => {
  const visible = Object.entries(step.view.relationStates).filter(([, state]) => state.visible);
  if (step.view.activeRoutes.length > 0) {
    return Object.fromEntries(
      Object.entries(step.view.relationStates).map(([id, state]) => [
        id,
        state.visible ? { ...state, visible: false, emphasis: 'dimmed' as const } : state,
      ]),
    );
  }

  const keep = new Set(
    visible
      .sort(([leftId, leftState], [rightId, rightState]) => {
        const left = step.world.relations[leftId];
        const right = step.world.relations[rightId];
        if (!left || !right) return leftId.localeCompare(rightId);
        return relationScore(right, rightState) - relationScore(left, leftState);
      })
      .slice(0, CONTEXT_RELATION_LIMIT[step.view.view])
      .map(([id]) => id),
  );

  return Object.fromEntries(
    Object.entries(step.view.relationStates).map(([id, state]) => [
      id,
      state.visible && !keep.has(id)
        ? { ...state, visible: false, emphasis: 'dimmed' as const }
        : state,
    ]),
  );
};

const simplifiedEntities = (step: CompiledStep): Readonly<Record<EntityId, EntityViewState>> => {
  const routeIds = routeEntityIds(step);
  const focusId = focusedEntityId(step);
  const contextIds = semanticContextIds(step, focusId);
  for (const id of routeIds) contextIds.add(id);

  return Object.fromEntries(
    Object.entries(step.view.entityStates).map(([id, state]) => {
      if (!state.visible || state.emphasis === 'hidden') return [id, state];
      const onRoute = routeIds.has(id);
      const isFocus = id === focusId || state.emphasis === 'focused';
      const shouldLabel = onRoute || isFocus || contextIds.has(id);
      // Responsive scene grammar owns the hard label budget; this pass may only remove labels.
      let labelMode: EntityViewState['labelMode'] = 'none';
      if (state.labelMode !== 'none' && shouldLabel) {
        labelMode = onRoute || isFocus ? 'full' : 'short';
      }
      return [
        id,
        {
          ...state,
          labelMode,
          emphasis:
            onRoute || isFocus
              ? 'focused'
              : step.view.activeRoutes.length > 0 && !contextIds.has(id)
                ? 'dimmed'
                : state.emphasis,
        },
      ];
    }),
  );
};

const simplifiedTransition = (
  step: CompiledStep,
  relations: Readonly<Record<RelationId, RelationViewState>>,
): readonly TransitionCue[] =>
  step.transition.cues.filter((cue) => {
    if (cue.type === 'callout') return false;
    if (cue.type === 'relation-reveal') return relations[cue.relationId]?.visible === true;
    return true;
  });

/**
 * Guided lessons should show one causal story, not every available graph edge.
 * This preserves the factual world and authored route while reducing labels and background lines.
 */
export function beginnerFocusedStep(step: CompiledStep): CompiledStep {
  const relationStates = simplifiedRelations(step);
  return {
    ...step,
    view: {
      ...step.view,
      entityStates: simplifiedEntities(step),
      relationStates,
      callouts: [],
    },
    transition: {
      cues: simplifiedTransition(step, relationStates),
    },
  };
}
