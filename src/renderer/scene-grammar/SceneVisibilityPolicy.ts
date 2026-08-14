import type {
  EntityViewState,
  RelationViewState,
  ViewMode,
  ViewProjection,
} from '../../course/types';
import type {
  EntityId,
  RelationId,
  RelationSemantic,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../world/types';
import { getTeachingRouteStyle } from '../relations/RelationStyleCatalog';
import { controlFlowGrammar } from './ControlFlowGrammar';
import { logicalOwnershipGrammar } from './LogicalOwnershipGrammar';
import { overviewGrammar } from './OverviewGrammar';
import { placementRuntimeGrammar } from './PlacementRuntimeGrammar';
import type {
  EffectiveScenePlan,
  EffectiveScenePlanOptions,
  SceneEntityRole,
  SceneGrammar,
  SceneHiddenReason,
} from './SceneGrammar';
import { storageGrammar } from './StorageGrammar';
import { trafficGrammar } from './TrafficGrammar';

export const SCENE_GRAMMARS: Readonly<Record<ViewMode, SceneGrammar>> = Object.freeze({
  overview: overviewGrammar,
  logical: logicalOwnershipGrammar,
  placement: placementRuntimeGrammar,
  'control-flow': controlFlowGrammar,
  traffic: trafficGrammar,
  storage: storageGrammar,
});

export function sceneGrammarFor(view: ViewMode): SceneGrammar {
  return SCENE_GRAMMARS[view];
}

function entityRole(grammar: SceneGrammar, entity: WorldEntity): SceneEntityRole {
  return grammar.primaryEntityKinds.includes(entity.kind) ? 'primary' : 'secondary';
}

function routeParticipants(projection: ViewProjection): ReadonlySet<EntityId> {
  return new Set(
    projection.activeRoutes.flatMap((route) =>
      route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]),
    ),
  );
}

function priorityContext(
  world: WorldSnapshot,
  projection: ViewProjection,
  participants: ReadonlySet<EntityId>,
): ReadonlySet<EntityId> {
  const priority = new Set(participants);
  for (const callout of projection.callouts) priority.add(callout.entityId);
  for (const [id, state] of Object.entries(projection.entityStates)) {
    if (state.emphasis === 'focused') priority.add(id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const entityId of [...priority]) {
      const entity = world.entities[entityId];
      if (!entity || (entity.kind !== 'Kubelet' && entity.kind !== 'ContainerRuntime')) continue;
      const nodeName = typeof entity.data.nodeName === 'string' ? entity.data.nodeName : undefined;
      if (!nodeName) continue;
      const node = Object.values(world.entities).find(
        (candidate) => candidate.kind === 'Node' && candidate.name === nodeName,
      );
      if (node && !priority.has(node.id)) {
        priority.add(node.id);
        changed = true;
      }
    }
    for (const relation of Object.values(world.relations)) {
      // composition and placement both point from the dependent Pod/Container chain outward:
      // Pod -> Container needs the Pod when Container is focused; Pod -> Node needs the Node.
      if (
        relation.semantic === 'composition' &&
        priority.has(relation.to) &&
        !priority.has(relation.from)
      ) {
        priority.add(relation.from);
        changed = true;
      }
      if (
        relation.semantic === 'placement' &&
        priority.has(relation.from) &&
        !priority.has(relation.to)
      ) {
        priority.add(relation.to);
        changed = true;
      }
    }
  }
  return priority;
}

function rankEntity(
  grammar: SceneGrammar,
  projection: ViewProjection,
  participants: ReadonlySet<EntityId>,
  entity: WorldEntity,
): readonly [number, number, number, string] {
  const state = projection.entityStates[entity.id];
  const kindRank = grammar.entityKindPriority.indexOf(entity.kind);
  return [
    participants.has(entity.id) ? 0 : 1,
    state?.emphasis === 'focused' ? 0 : state?.emphasis === 'normal' ? 1 : 2,
    kindRank < 0 ? Number.MAX_SAFE_INTEGER : kindRank,
    entity.id,
  ];
}

function compareRank(
  left: readonly [number, number, number, string],
  right: readonly [number, number, number, string],
): number {
  return (
    left[0] - right[0] ||
    left[1] - right[1] ||
    left[2] - right[2] ||
    left[3].localeCompare(right[3])
  );
}

const hiddenEntityState: EntityViewState = Object.freeze({
  visible: false,
  emphasis: 'hidden',
  labelMode: 'none',
  inspectorMode: 'none',
});

function cappedFamilies(
  grammar: SceneGrammar,
  relations: readonly WorldRelation[],
  projection: ViewProjection,
  maximum: number,
): ReadonlySet<RelationSemantic> {
  const present = new Set(relations.map((relation) => relation.semantic));
  const focused = new Set(
    relations
      .filter((relation) => projection.relationStates[relation.id]?.emphasis === 'focused')
      .map((relation) => relation.semantic),
  );
  const ordered = grammar.relationFamilyPriority
    .filter((semantic) => present.has(semantic))
    .sort((left, right) => Number(!focused.has(left)) - Number(!focused.has(right)));
  return new Set(ordered.slice(0, maximum));
}

/** Build a deterministic, density-bounded projection from authored intent plus a view grammar. */
export function createEffectiveScenePlan(
  world: WorldSnapshot,
  authoredProjection: ViewProjection,
  options: EffectiveScenePlanOptions = {},
): EffectiveScenePlan {
  const viewport = options.viewport ?? 'desktop';
  const grammar = sceneGrammarFor(authoredProjection.view);
  const budget = grammar.budgets[viewport];
  const allowedKinds = new Set(grammar.allowedEntityKinds);
  const defaultHiddenKinds = new Set(grammar.defaultHiddenEntityKinds);
  const participants = routeParticipants(authoredProjection);
  const priorityIds = priorityContext(world, authoredProjection, participants);
  const isKindAllowed = (entity: WorldEntity): boolean =>
    allowedKinds.has(entity.kind) ||
    Boolean(
      options.allowFocusedKindOverride &&
      authoredProjection.entityStates[entity.id]?.emphasis === 'focused',
    );
  for (const route of authoredProjection.activeRoutes) {
    if (!grammar.routeRules.allowedSemantics.includes(route.semantic)) {
      throw new Error(
        `Route "${route.id}" semantic "${route.semantic}" is not allowed in ${grammar.id} view`,
      );
    }
    if (grammar.routeRules.requirePersistentRoute && !route.persistAfterAnimation) {
      throw new Error(`Route "${route.id}" must remain persistent in ${grammar.id} view`);
    }
  }
  const animatedTokenDemand = authoredProjection.activeRoutes.reduce(
    (total, route) => total + getTeachingRouteStyle(route.semantic).tokenCount,
    0,
  );
  if (animatedTokenDemand > budget.maxAnimatedTokens) {
    throw new Error(
      `${grammar.id} view requires ${animatedTokenDemand} route tokens but its budget allows ${budget.maxAnimatedTokens}`,
    );
  }
  for (const participantId of participants) {
    const participant = world.entities[participantId];
    if (participant && !isKindAllowed(participant)) {
      throw new Error(
        `Route participant "${participantId}" kind "${participant.kind}" is not allowed in ${grammar.id} view`,
      );
    }
  }
  const hiddenReasons: Record<EntityId, SceneHiddenReason> = {};
  const candidates: WorldEntity[] = [];

  for (const entity of Object.values(world.entities)) {
    const state = authoredProjection.entityStates[entity.id];
    if (!state?.visible || state.emphasis === 'hidden') {
      hiddenReasons[entity.id] = 'authored-hidden';
    } else if (!isKindAllowed(entity)) {
      hiddenReasons[entity.id] = 'kind-not-allowed';
    } else if (
      options.applyGrammarDefaults &&
      defaultHiddenKinds.has(entity.kind) &&
      !participants.has(entity.id) &&
      state.emphasis !== 'focused'
    ) {
      hiddenReasons[entity.id] = 'default-hidden';
    } else {
      candidates.push(entity);
    }
  }

  candidates.sort((left, right) =>
    compareRank(
      rankEntity(grammar, authoredProjection, priorityIds, left),
      rankEntity(grammar, authoredProjection, priorityIds, right),
    ),
  );

  const kept: WorldEntity[] = [];
  const keptByKind = new Map<string, number>();
  let primaryCount = 0;
  let secondaryCount = 0;
  for (const entity of candidates) {
    const role = entityRole(grammar, entity);
    const kindMaximum = grammar.maxVisibleByKind?.[entity.kind];
    if (kindMaximum !== undefined && (keptByKind.get(entity.kind) ?? 0) >= kindMaximum) {
      hiddenReasons[entity.id] = 'kind-budget';
      continue;
    }
    const maximum = role === 'primary' ? budget.maxPrimaryEntities : budget.maxSecondaryEntities;
    const count = role === 'primary' ? primaryCount : secondaryCount;
    if (count >= maximum) {
      hiddenReasons[entity.id] = role === 'primary' ? 'primary-budget' : 'secondary-budget';
      continue;
    }
    kept.push(entity);
    keptByKind.set(entity.kind, (keptByKind.get(entity.kind) ?? 0) + 1);
    if (role === 'primary') primaryCount += 1;
    else secondaryCount += 1;
  }

  const visibleIds = new Set(kept.map((entity) => entity.id));
  let closureChanged = true;
  while (closureChanged) {
    closureChanged = false;
    for (const relation of Object.values(world.relations)) {
      const dependentId = relation.semantic === 'composition' ? relation.to : relation.from;
      const requiredId = relation.semantic === 'composition' ? relation.from : relation.to;
      // Placement view must show the physical Node that contains a scheduled Pod. Control-flow
      // view is different: it may intentionally teach the Pod API object immediately after the
      // scheduler writes nodeName, before the lesson switches to the physical Node view. The
      // strict control-flow layout has an explicit assigned-Pod context lane for that case.
      const enforcesClosure =
        relation.semantic === 'composition' ||
        (grammar.id === 'placement' && relation.semantic === 'placement');
      if (enforcesClosure && visibleIds.has(dependentId) && !visibleIds.has(requiredId)) {
        visibleIds.delete(dependentId);
        hiddenReasons[dependentId] = 'required-context-missing';
        closureChanged = true;
      }
    }
  }
  for (const participantId of participants) {
    if (world.entities[participantId] && !visibleIds.has(participantId)) {
      throw new Error(
        `Route participant "${participantId}" exceeds the ${grammar.id} density budget`,
      );
    }
  }
  for (const callout of authoredProjection.callouts) {
    if (world.entities[callout.entityId] && !visibleIds.has(callout.entityId)) {
      throw new Error(
        `Callout target "${callout.entityId}" exceeds the ${grammar.id} density budget`,
      );
    }
  }
  const entityStates: Record<EntityId, EntityViewState> = {};
  let focusedCount = 0;
  let labelCount = 0;
  for (const entity of Object.values(world.entities).sort((left, right) =>
    compareRank(
      rankEntity(grammar, authoredProjection, priorityIds, left),
      rankEntity(grammar, authoredProjection, priorityIds, right),
    ),
  )) {
    if (!visibleIds.has(entity.id)) {
      entityStates[entity.id] = hiddenEntityState;
      continue;
    }
    const authored = authoredProjection.entityStates[entity.id]!;
    const canFocus = authored.emphasis !== 'focused' || focusedCount < budget.maxFocusedEntities;
    const emphasis = authored.emphasis === 'focused' && !canFocus ? 'normal' : authored.emphasis;
    if (emphasis === 'focused') focusedCount += 1;
    const canLabel = authored.labelMode === 'none' || labelCount < budget.maxEntityLabels;
    const labelMode = canLabel ? authored.labelMode : 'none';
    if (labelMode !== 'none') labelCount += 1;
    entityStates[entity.id] = { ...authored, emphasis, labelMode };
  }

  const relationCandidates = Object.values(world.relations)
    .filter((relation) => {
      const state = authoredProjection.relationStates[relation.id];
      return (
        state?.visible &&
        visibleIds.has(relation.from) &&
        visibleIds.has(relation.to) &&
        grammar.allowedRelationSemantics.includes(relation.semantic) &&
        !(
          options.applyGrammarDefaults &&
          grammar.defaultHiddenRelationSemantics.includes(relation.semantic)
        )
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const visibleFamilies = cappedFamilies(
    grammar,
    relationCandidates,
    authoredProjection,
    budget.maxRelationFamilies,
  );
  const relationStates: Record<RelationId, RelationViewState> = {};
  for (const relation of Object.values(world.relations)) {
    const authored = authoredProjection.relationStates[relation.id] ?? {
      visible: false,
      emphasis: 'normal' as const,
    };
    relationStates[relation.id] = {
      ...authored,
      visible: relationCandidates.includes(relation) && visibleFamilies.has(relation.semantic),
    };
  }

  const projection: ViewProjection = {
    ...authoredProjection,
    entityStates,
    relationStates,
  };
  const visibleEntityIds = [...visibleIds].sort();
  return Object.freeze({
    grammarId: grammar.id,
    viewport,
    projection,
    visibleEntityIds,
    primaryEntityIds: kept
      .filter((entity) => visibleIds.has(entity.id) && entityRole(grammar, entity) === 'primary')
      .map((entity) => entity.id)
      .sort(),
    secondaryEntityIds: kept
      .filter((entity) => visibleIds.has(entity.id) && entityRole(grammar, entity) === 'secondary')
      .map((entity) => entity.id)
      .sort(),
    visibleRelationIds: relationCandidates
      .filter((relation) => visibleFamilies.has(relation.semantic))
      .map((relation) => relation.id)
      .sort(),
    visibleRelationFamilies: [...visibleFamilies],
    hiddenEntityReasons: Object.freeze(hiddenReasons),
    densityBudget: budget,
    layoutAlgorithm: grammar.layoutAlgorithm,
    cameraType: grammar.cameraType,
    zones: grammar.zones,
  });
}
