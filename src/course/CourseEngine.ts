import {
  applyWorldPatch,
  computeWorldDiff,
  deepFreeze,
  getContainerData,
  getPodData,
} from '../world';
import type { EntityId, RelationId, WorldEntity, WorldSnapshot } from '../world/types';
import type {
  ActiveTeachingRoute,
  ComparisonPanelModel,
  ComparisonRequest,
  CompiledLesson,
  CompiledStep,
  EntitySelector,
  EntityViewState,
  LessonV2,
  RelationViewState,
  TransitionCue,
  TransitionPlan,
  ViewProjection,
  ViewProjectionPatch,
} from './types';
import { humanizeWorldDiff } from './diff/humanizeWorldDiff';

const emptyTransition: TransitionPlan = { cues: [] };

function freezeValue<T>(value: T): T {
  return deepFreeze(structuredClone(value)) as unknown as T;
}

function initialProjection(world: WorldSnapshot): ViewProjection {
  const entityStates = Object.fromEntries(
    Object.values(world.entities).map((entity) => [
      entity.id,
      {
        visible: true,
        emphasis: 'normal',
        labelMode: 'short',
        inspectorMode: 'none',
      } satisfies EntityViewState,
    ]),
  ) as Record<EntityId, EntityViewState>;
  const relationStates = Object.fromEntries(
    Object.values(world.relations).map((relation) => [
      relation.id,
      { visible: false, emphasis: 'normal' } satisfies RelationViewState,
    ]),
  ) as Record<RelationId, RelationViewState>;
  return {
    view: 'placement',
    cameraPresetId: 'placement',
    entityStates,
    relationStates,
    callouts: [],
    activeRoutes: [],
  };
}

function selectEntities(world: WorldSnapshot, selector: EntitySelector): readonly WorldEntity[] {
  const entities = Object.values(world.entities);
  if ('byIds' in selector) return selector.byIds.flatMap((id) => world.entities[id] ?? []);
  if ('byKind' in selector) {
    return entities.filter(
      (entity) =>
        entity.kind === selector.byKind &&
        (!selector.namespace || entity.namespace === selector.namespace),
    );
  }
  if ('byLabel' in selector) {
    return entities.filter(
      (entity) =>
        entity.labels?.[selector.byLabel.key] === selector.byLabel.value &&
        (!selector.namespace || entity.namespace === selector.namespace),
    );
  }
  if ('byCategory' in selector)
    return entities.filter((entity) => entity.category === selector.byCategory);
  return entities.filter((entity) => entity.data.nodeName === selector.byNode);
}

export function applyViewProjectionPatch(
  previous: ViewProjection,
  patch: ViewProjectionPatch,
  world: WorldSnapshot,
): ViewProjection {
  const entityStates: Record<EntityId, EntityViewState> = { ...previous.entityStates };
  if (patch.resetEntities) {
    for (const id of Object.keys(entityStates)) {
      entityStates[id] = {
        visible: false,
        emphasis: 'hidden',
        labelMode: 'none',
        inspectorMode: 'none',
      };
    }
  }
  for (const rule of patch.entityRules ?? []) {
    const matches = selectEntities(world, rule.selector);
    if (matches.length === 0 && !rule.allowEmpty) {
      throw new Error(`Entity selector matched nothing: ${JSON.stringify(rule.selector)}`);
    }
    for (const entity of matches) {
      const current = entityStates[entity.id] ?? {
        visible: false,
        emphasis: 'hidden',
        labelMode: 'none',
        inspectorMode: 'none',
      };
      const next: EntityViewState = {
        visible: rule.visible ?? current.visible,
        emphasis: rule.emphasis ?? current.emphasis,
        labelMode: rule.labelMode ?? current.labelMode,
      };
      const inspectorMode = rule.inspectorMode ?? current.inspectorMode;
      entityStates[entity.id] = inspectorMode ? { ...next, inspectorMode } : next;
    }
  }

  const relationStates: Record<RelationId, RelationViewState> = { ...previous.relationStates };
  for (const rule of patch.relationRules ?? []) {
    const matches = Object.values(world.relations).filter(
      (relation) =>
        (!rule.byType || relation.type === rule.byType) &&
        (!rule.byIds || rule.byIds.includes(relation.id)),
    );
    if (matches.length === 0 && !rule.allowEmpty) {
      throw new Error(`Relation selector matched nothing: ${JSON.stringify(rule)}`);
    }
    for (const relation of matches) {
      const current = relationStates[relation.id] ?? { visible: false, emphasis: 'normal' };
      relationStates[relation.id] = {
        visible: rule.visible ?? current.visible,
        emphasis: rule.emphasis ?? current.emphasis,
      };
    }
  }

  return freezeValue({
    view: patch.view ?? previous.view,
    cameraPresetId: patch.cameraPresetId ?? previous.cameraPresetId,
    entityStates,
    relationStates,
    callouts: patch.callouts ?? [],
    activeRoutes: patch.activeRoutes ?? [],
  });
}

function entity(world: WorldSnapshot, id: EntityId): WorldEntity {
  const value = world.entities[id];
  if (!value) throw new Error(`Expected entity ${id} in comparison snapshot`);
  return value;
}

function containerForPod(world: WorldSnapshot, podId: EntityId): WorldEntity {
  const value = Object.values(world.entities).find(
    (candidate) =>
      candidate.kind === 'Container' &&
      typeof candidate.data.podId === 'string' &&
      candidate.data.podId === podId,
  );
  if (!value) throw new Error(`Expected Container for ${podId}`);
  return value;
}

function buildComparison(
  request: ComparisonRequest,
  compiledSteps: readonly CompiledStep[],
  initialWorld: WorldSnapshot,
): ComparisonPanelModel {
  const restart = compiledSteps.find((step) => step.stepId === request.restartStepId);
  const replacement = compiledSteps.find((step) => step.stepId === request.replacementStepId);
  if (!restart || !replacement)
    throw new Error('Comparison references an unavailable earlier step');

  const restartedContainerUpdate = restart.worldDiff.updatedEntities.find(
    (update) =>
      update.after.kind === 'Container' &&
      update.changedPaths.some(
        (path) =>
          path === '/data/restartCount' ||
          path === '/data/containerID' ||
          path.startsWith('/data/lastState'),
      ),
  );
  const oldPodId = restartedContainerUpdate?.after.data.podId;
  const replacementPod = Object.values(replacement.world.entities).find(
    (candidate) => candidate.kind === 'Pod' && initialWorld.entities[candidate.id] === undefined,
  );
  if (typeof oldPodId !== 'string' || !replacementPod) {
    throw new Error('Comparison Pod identities cannot be derived from the compiled snapshots');
  }

  const originalPod = entity(initialWorld, oldPodId);
  const restartedPod = entity(restart.world, oldPodId);
  const originalContainer = containerForPod(initialWorld, oldPodId);
  const restartedContainer = containerForPod(restart.world, oldPodId);
  const replacementContainer = containerForPod(replacement.world, replacementPod.id);
  const restartedPodData = getPodData(restartedPod);
  const replacementPodData = getPodData(replacementPod);
  const originalContainerData = getContainerData(originalContainer);
  const restartedContainerData = getContainerData(restartedContainer);
  const replacementContainerData = getContainerData(replacementContainer);

  return freezeValue({
    title: {
      en: 'Container restart vs Pod replacement',
      ja: 'コンテナ再起動と Pod 置換',
      'zh-CN': '容器重启与 Pod 替换',
    },
    rows: [
      {
        property: { en: 'Pod name', ja: 'Pod 名', 'zh-CN': 'Pod 名称' },
        containerRestart: {
          en: `same ${restartedPod.name}`,
          ja: `同一 ${restartedPod.name}`,
          'zh-CN': `同一 ${restartedPod.name}`,
        },
        podReplacement: {
          en: `${originalPod.name} removed; new ${replacementPod.name}`,
          ja: `${originalPod.name} を削除、新規 ${replacementPod.name}`,
          'zh-CN': `删除 ${originalPod.name}；新建 ${replacementPod.name}`,
        },
      },
      {
        property: { en: 'Pod UID', ja: 'Pod UID', 'zh-CN': 'Pod UID' },
        containerRestart: {
          en: `unchanged ${restartedPodData.uid}`,
          ja: `変更なし ${restartedPodData.uid}`,
          'zh-CN': `未改变 ${restartedPodData.uid}`,
        },
        podReplacement: {
          en: `new ${replacementPodData.uid}`,
          ja: `新規 ${replacementPodData.uid}`,
          'zh-CN': `新建 ${replacementPodData.uid}`,
        },
      },
      {
        property: { en: 'Node', ja: 'Node', 'zh-CN': 'Node' },
        containerRestart: {
          en: `unchanged ${restartedPodData.nodeName ?? 'Unscheduled'}`,
          ja: `変更なし ${restartedPodData.nodeName ?? '未スケジュール'}`,
          'zh-CN': `未改变 ${restartedPodData.nodeName ?? '未调度'}`,
        },
        podReplacement: {
          en: `may change; here ${replacementPodData.nodeName ?? 'Unscheduled'}`,
          ja: `変わり得る；ここでは ${replacementPodData.nodeName ?? '未スケジュール'}`,
          'zh-CN': `可能改变；此处为 ${replacementPodData.nodeName ?? '未调度'}`,
        },
      },
      {
        property: { en: 'Container ID', ja: 'Container ID', 'zh-CN': 'Container ID' },
        containerRestart: {
          en: `${originalContainerData.containerID ?? 'none'} → ${restartedContainerData.containerID ?? 'none'}`,
          ja: `${originalContainerData.containerID ?? 'なし'} → ${restartedContainerData.containerID ?? 'なし'}`,
          'zh-CN': `${originalContainerData.containerID ?? '无'} → ${restartedContainerData.containerID ?? '无'}`,
        },
        podReplacement: {
          en: `new ${replacementContainerData.containerID ?? 'not created'}`,
          ja: `新規 ${replacementContainerData.containerID ?? '未作成'}`,
          'zh-CN': `新建 ${replacementContainerData.containerID ?? '尚未创建'}`,
        },
      },
      {
        property: {
          en: 'Container restart count',
          ja: 'Container 再起動回数',
          'zh-CN': '容器重启次数',
        },
        containerRestart: {
          en: `${originalContainerData.restartCount} → ${restartedContainerData.restartCount}`,
          ja: `${originalContainerData.restartCount} → ${restartedContainerData.restartCount}`,
          'zh-CN': `${originalContainerData.restartCount} → ${restartedContainerData.restartCount}`,
        },
        podReplacement: {
          en: `new Container starts at ${replacementContainerData.restartCount}`,
          ja: `新しい Container は ${replacementContainerData.restartCount} から開始`,
          'zh-CN': `新容器从 ${replacementContainerData.restartCount} 开始`,
        },
      },
      {
        property: { en: 'Pod object', ja: 'Pod オブジェクト', 'zh-CN': 'Pod 对象' },
        containerRestart:
          originalPod.id === restartedPod.id
            ? { en: 'remains', ja: '維持', 'zh-CN': '保持不变' }
            : { en: 'changed', ja: '変更', 'zh-CN': '已改变' },
        podReplacement: {
          en: 'old removed; new object created',
          ja: '旧オブジェクトを削除し、新規作成',
          'zh-CN': '删除旧对象并创建新对象',
        },
      },
      {
        property: {
          en: 'Local ephemeral data',
          ja: 'ローカル一時データ',
          'zh-CN': '本地临时数据',
        },
        containerRestart: {
          en: 'same Pod lifecycle only',
          ja: '同じ Pod ライフサイクル内のみ',
          'zh-CN': '仅限同一 Pod 生命周期',
        },
        podReplacement: {
          en: 'not automatically preserved',
          ja: '自動では保持されない',
          'zh-CN': '不会自动保留',
        },
      },
    ],
  });
}

function valueAtPath(entityValue: WorldEntity, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = entityValue;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function requireEntity(world: WorldSnapshot, id: EntityId, cue: TransitionCue): void {
  if (!world.entities[id]) throw new Error(`${cue.type} references missing entity: ${id}`);
}

const routedCueSemantics = {
  'data-packet': 'data-flow',
  'dns-query': 'dns',
  'api-request': 'control',
  'reconcile-pulse': 'control',
  'scheduler-assignment': 'scheduling',
  'node-runtime-restart': 'node-runtime',
} as const;

type RoutedCue = Extract<TransitionCue, { readonly routeId: string }>;

function routeForCue(
  cue: RoutedCue,
  routes: ReadonlyMap<string, ActiveTeachingRoute>,
): ActiveTeachingRoute {
  const route = routes.get(cue.routeId);
  if (!route) throw new Error(`${cue.type} references missing active route: ${cue.routeId}`);
  const expected = routedCueSemantics[cue.type];
  if (route.semantic !== expected) {
    throw new Error(
      `${cue.type} requires a ${expected} route, but ${route.id} is ${route.semantic}`,
    );
  }
  return route;
}

function routeContainsEntity(route: ActiveTeachingRoute, entityId: EntityId): boolean {
  return route.hops.some((hop) => hop.fromEntityId === entityId || hop.toEntityId === entityId);
}

function localNodeName(entityId: EntityId, world: WorldSnapshot): string | undefined {
  const entity = world.entities[entityId];
  if (!entity) return undefined;
  if (entity.kind === 'Node') return entity.name;
  if (entity.kind === 'Kubelet') {
    return typeof entity.data.nodeName === 'string' ? entity.data.nodeName : undefined;
  }
  if (entity.kind === 'Pod') return getPodData(entity).nodeName;
  if (entity.kind === 'Container') {
    const pod = world.entities[getContainerData(entity).podId];
    return pod?.kind === 'Pod' ? getPodData(pod).nodeName : undefined;
  }
  return undefined;
}

function validateNodeRuntimeRestart(
  cue: Extract<TransitionCue, { readonly type: 'node-runtime-restart' }>,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
  routes: ReadonlyMap<string, ActiveTeachingRoute>,
): void {
  const before = beforeWorld.entities[cue.entityId];
  const after = world.entities[cue.entityId];
  if (!before || !after || before.kind !== 'Container' || after.kind !== 'Container') {
    throw new Error(`node-runtime-restart target must be one Container present in both worlds`);
  }
  if (before.status !== 'terminated' || after.status !== 'running') {
    throw new Error(`node-runtime-restart must transition a terminated Container to running`);
  }

  const beforeData = getContainerData(before);
  const afterData = getContainerData(after);
  if (beforeData.podId !== afterData.podId) {
    throw new Error(`node-runtime-restart cannot move the Container to a different Pod`);
  }
  const beforePod = beforeWorld.entities[beforeData.podId];
  const afterPod = world.entities[afterData.podId];
  if (!beforePod || !afterPod || beforePod.kind !== 'Pod' || afterPod.kind !== 'Pod') {
    throw new Error(`node-runtime-restart requires its parent Pod in both worlds`);
  }
  const beforePodData = getPodData(beforePod);
  const afterPodData = getPodData(afterPod);
  if (
    beforePodData.uid !== afterPodData.uid ||
    !afterPodData.nodeName ||
    beforePodData.nodeName !== afterPodData.nodeName
  ) {
    throw new Error(`node-runtime-restart must preserve Pod UID and Node assignment`);
  }
  const lastState = afterData.lastState;
  if (
    beforeData.state.kind !== 'terminated' ||
    afterData.state.kind !== 'running' ||
    !beforeData.containerID ||
    !afterData.containerID ||
    beforeData.containerID === afterData.containerID ||
    afterData.restartCount !== beforeData.restartCount + 1 ||
    !lastState ||
    lastState.containerID !== beforeData.containerID ||
    lastState.reason !== beforeData.state.reason ||
    lastState.exitCode !== beforeData.state.exitCode
  ) {
    throw new Error(
      `node-runtime-restart must replace containerID, increment restartCount, and preserve the termination in lastState`,
    );
  }

  const route = routeForCue(cue, routes);
  const firstHop = route.hops[0];
  const lastHop = route.hops.at(-1);
  const firstEntity = firstHop ? world.entities[firstHop.fromEntityId] : undefined;
  if (!firstHop || firstEntity?.kind !== 'Kubelet') {
    throw new Error(`${route.id} must start at the kubelet on ${afterPodData.nodeName}`);
  }
  if (lastHop?.toEntityId !== cue.entityId) {
    throw new Error(`${route.id} must end at restarted Container ${cue.entityId}`);
  }

  const routeEntityIds = new Set(route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]));
  for (const entityId of routeEntityIds) {
    if (localNodeName(entityId, world) !== afterPodData.nodeName) {
      throw new Error(
        `${route.id} must stay on ${afterPodData.nodeName} before reaching the Container`,
      );
    }
  }
}

function validateActiveRoutes(
  routes: readonly ActiveTeachingRoute[],
  transition: TransitionPlan,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): ReadonlyMap<string, ActiveTeachingRoute> {
  const byId = new Map<string, ActiveTeachingRoute>();
  for (const route of routes) {
    if (byId.has(route.id)) throw new Error(`Duplicate active route ID: ${route.id}`);
    if (route.hops.length === 0) throw new Error(`Active route ${route.id} has no hops`);
    for (let index = 1; index < route.hops.length; index += 1) {
      const previous = route.hops[index - 1];
      const current = route.hops[index];
      if (previous && current && previous.toEntityId !== current.fromEntityId) {
        throw new Error(
          `Active route ${route.id} is discontinuous between hops ${index} and ${index + 1}`,
        );
      }
    }
    byId.set(route.id, route);
  }

  const deleteRouteIds = new Set(
    transition.cues
      .filter(
        (cue): cue is Extract<TransitionCue, { type: 'api-request' }> => cue.type === 'api-request',
      )
      .map((cue) => cue.routeId),
  );
  for (const route of routes) {
    const allowBeforeEndpoint = deleteRouteIds.has(route.id);
    for (const hop of route.hops) {
      for (const endpoint of [hop.fromEntityId, hop.toEntityId]) {
        if (world.entities[endpoint]) continue;
        if (allowBeforeEndpoint && beforeWorld.entities[endpoint]) continue;
        throw new Error(`Active route ${route.id} references missing entity: ${endpoint}`);
      }
    }
  }
  return byId;
}

function validateTransitionCue(
  cue: TransitionCue,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
  routes: ReadonlyMap<string, ActiveTeachingRoute>,
): void {
  switch (cue.type) {
    case 'layout-transition':
      for (const entityId of cue.entityIds ?? []) {
        requireEntity(beforeWorld, entityId, cue);
        requireEntity(world, entityId, cue);
      }
      return;
    case 'entity-exit':
      requireEntity(beforeWorld, cue.entityId, cue);
      if (world.entities[cue.entityId])
        throw new Error(`entity-exit target still exists after patch: ${cue.entityId}`);
      return;
    case 'entity-enter':
      if (beforeWorld.entities[cue.entityId])
        throw new Error(`entity-enter target already existed: ${cue.entityId}`);
      requireEntity(world, cue.entityId, cue);
      return;
    case 'relation-reveal':
      if (!world.relations[cue.relationId])
        throw new Error(`relation-reveal references missing relation: ${cue.relationId}`);
      return;
    case 'reconcile-pulse':
      requireEntity(world, cue.fromEntityId, cue);
      requireEntity(world, cue.toEntityId, cue);
      if (!routeContainsEntity(routeForCue(cue, routes), cue.fromEntityId))
        throw new Error(`${cue.routeId} does not include reconcile source ${cue.fromEntityId}`);
      if (!routeContainsEntity(routeForCue(cue, routes), cue.toEntityId))
        throw new Error(`${cue.routeId} does not include reconcile target ${cue.toEntityId}`);
      return;
    case 'scheduler-assignment':
      requireEntity(world, cue.schedulerId, cue);
      requireEntity(world, cue.podId, cue);
      requireEntity(world, cue.nodeId, cue);
      for (const id of [cue.schedulerId, cue.podId, cue.nodeId]) {
        if (!routeContainsEntity(routeForCue(cue, routes), id))
          throw new Error(`${cue.routeId} does not include scheduler assignment entity ${id}`);
      }
      return;
    case 'counter-change': {
      const before = beforeWorld.entities[cue.entityId];
      const after = world.entities[cue.entityId];
      if (!before || !after) throw new Error(`counter-change target is not present in both worlds`);
      if (cue.from === cue.to) throw new Error(`counter-change must describe a factual change`);
      if (valueAtPath(before, cue.field) !== cue.from || valueAtPath(after, cue.field) !== cue.to) {
        throw new Error(`counter-change values contradict ${cue.field}`);
      }
      return;
    }
    case 'node-runtime-restart':
      validateNodeRuntimeRestart(cue, beforeWorld, world, routes);
      return;
    case 'container-start': {
      const before = beforeWorld.entities[cue.entityId];
      const after = world.entities[cue.entityId];
      if (!before || !after || before.kind !== 'Container' || after.kind !== 'Container') {
        throw new Error(`container-start target must be one Container present in both worlds`);
      }
      if (
        (before.status !== 'waiting' && before.status !== 'starting') ||
        after.status !== 'running'
      ) {
        throw new Error(`container-start must transition a waiting/starting Container to running`);
      }
      const beforeData = getContainerData(before);
      const afterData = getContainerData(after);
      if (
        beforeData.state.kind !== 'waiting' ||
        afterData.state.kind !== 'running' ||
        beforeData.containerID ||
        !afterData.containerID ||
        beforeData.restartCount !== afterData.restartCount ||
        beforeData.podId !== afterData.podId
      ) {
        throw new Error(
          `container-start must create the first containerID without changing restartCount or Pod`,
        );
      }
      return;
    }
    case 'data-packet':
    case 'dns-query':
    case 'api-request':
      routeForCue(cue, routes);
      return;
    case 'focus-camera':
    case 'container-failure':
    case 'container-restart':
    case 'callout':
      requireEntity(world, cue.entityId, cue);
  }
}

const cueDelay = (cue: TransitionCue): number => cue.delayMs ?? 0;

function requireCausalOffset(
  transition: TransitionPlan,
  causeType: TransitionCue['type'],
  effectType: TransitionCue['type'],
): void {
  const cause = transition.cues.find((cue) => cue.type === causeType);
  const effect = transition.cues.find((cue) => cue.type === effectType);
  if (!cause || !effect) return;
  if (cueDelay(effect) <= cueDelay(cause)) {
    throw new Error(`${effectType} must start after ${causeType} to preserve causal order`);
  }
}

function validateCausalTiming(transition: TransitionPlan): void {
  requireCausalOffset(transition, 'api-request', 'entity-exit');
  requireCausalOffset(transition, 'reconcile-pulse', 'entity-enter');
  requireCausalOffset(transition, 'reconcile-pulse', 'container-restart');
  requireCausalOffset(transition, 'reconcile-pulse', 'container-start');
  requireCausalOffset(transition, 'scheduler-assignment', 'layout-transition');
}

function validateReplicaSetCounterCoverage(
  transition: TransitionPlan,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): void {
  const fields = ['specReplicas', 'statusReplicas', 'readyReplicas'] as const;
  for (const before of Object.values(beforeWorld.entities)) {
    if (before.kind !== 'ReplicaSet') continue;
    const after = world.entities[before.id];
    if (!after || after.kind !== 'ReplicaSet') continue;
    for (const field of fields) {
      const from = before.data[field];
      const to = after.data[field];
      if (from === to) continue;
      const covered = transition.cues.some(
        (cue) =>
          cue.type === 'counter-change' &&
          cue.entityId === before.id &&
          cue.field === `data.${field}` &&
          cue.from === from &&
          cue.to === to,
      );
      if (!covered) {
        throw new Error(`ReplicaSet ${before.id} change to data.${field} needs counter-change cue`);
      }
    }
  }
}

function validateTransition(
  transition: TransitionPlan,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
  view: ViewProjection,
): void {
  const routes = validateActiveRoutes(view.activeRoutes, transition, beforeWorld, world);
  const routedCueIds = transition.cues
    .filter((cue): cue is RoutedCue => 'routeId' in cue)
    .map((cue) => cue.routeId);
  if (new Set(routedCueIds).size !== routedCueIds.length) {
    throw new Error('A transition cannot animate the same active route more than once');
  }
  for (const cue of transition.cues) validateTransitionCue(cue, beforeWorld, world, routes);
  validateCausalTiming(transition);
  validateReplicaSetCounterCoverage(transition, beforeWorld, world);
}

export const courseEngine = {
  compileLesson(lesson: LessonV2, initialWorld: WorldSnapshot): CompiledLesson {
    if (lesson.scenarioId !== initialWorld.scenarioId) {
      throw new Error(`Lesson ${lesson.id} requires scenario ${lesson.scenarioId}`);
    }
    let world = initialWorld;
    const compiledSteps: CompiledStep[] = [];
    for (const [index, authoredStep] of lesson.steps.entries()) {
      const beforeWorld = world;
      world = authoredStep.worldPatch
        ? applyWorldPatch(beforeWorld, authoredStep.worldPatch)
        : beforeWorld;
      const baseView = applyViewProjectionPatch(initialProjection(world), lesson.baseView, world);
      let view = applyViewProjectionPatch(baseView, authoredStep.viewPatch, world);
      if (authoredStep.viewPatch.comparison) {
        view = freezeValue({
          ...view,
          comparison: buildComparison(
            authoredStep.viewPatch.comparison,
            compiledSteps,
            initialWorld,
          ),
        });
      }
      const transition = freezeValue(authoredStep.transition ?? emptyTransition);
      validateTransition(transition, beforeWorld, world, view);
      const worldDiff = computeWorldDiff(beforeWorld, world);
      compiledSteps.push(
        freezeValue({
          lessonId: lesson.id,
          stepId: authoredStep.id,
          index,
          beforeWorld,
          world,
          worldDiff,
          evidence: humanizeWorldDiff(beforeWorld, world, worldDiff, authoredStep.evidence),
          view,
          transition,
        }),
      );
    }
    return freezeValue({ lesson, initialWorld, steps: compiledSteps });
  },

  getStep(compiled: CompiledLesson, stepIndex: number): CompiledStep {
    const step = compiled.steps[stepIndex];
    if (!step) throw new Error(`Invalid lesson step: ${stepIndex}`);
    return step;
  },

  compileDirect(lesson: LessonV2, initialWorld: WorldSnapshot, stepIndex: number): CompiledStep {
    return this.getStep(this.compileLesson(lesson, initialWorld), stepIndex);
  },
};
