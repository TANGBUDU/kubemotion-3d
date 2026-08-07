import {
  applyWorldPatch,
  computeWorldDiff,
  deepFreeze,
  getContainerData,
  getPodData,
} from '../world';
import type { EntityId, RelationId, WorldEntity, WorldSnapshot } from '../world/types';
import type {
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
        (path) => path === '/data/restartCount' || path === '/data/instanceGeneration',
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
        property: { en: 'Pod ID', ja: 'Pod ID', 'zh-CN': 'Pod ID' },
        containerRestart: `same ${restartedPod.id}`,
        podReplacement: `${oldPodId} removed; new ${replacementPod.id}`,
      },
      {
        property: { en: 'Pod UID', ja: 'Pod UID', 'zh-CN': 'Pod UID' },
        containerRestart: `unchanged ${restartedPodData.uid}`,
        podReplacement: `new ${replacementPodData.uid}`,
      },
      {
        property: { en: 'Node', ja: 'Node', 'zh-CN': 'Node' },
        containerRestart: `unchanged ${restartedPodData.nodeName ?? 'Unscheduled'}`,
        podReplacement: `may change; here ${replacementPodData.nodeName ?? 'Unscheduled'}`,
      },
      {
        property: {
          en: 'Container restart count',
          ja: 'Container 再起動回数',
          'zh-CN': '容器重启次数',
        },
        containerRestart: `${originalContainerData.restartCount} → ${restartedContainerData.restartCount}`,
        podReplacement: `new Container starts at ${replacementContainerData.restartCount}`,
      },
      {
        property: { en: 'Pod object', ja: 'Pod オブジェクト', 'zh-CN': 'Pod 对象' },
        containerRestart: originalPod.id === restartedPod.id ? 'remains' : 'changed',
        podReplacement: 'old removed; new object created',
      },
      {
        property: {
          en: 'Local ephemeral data',
          ja: 'ローカル一時データ',
          'zh-CN': '本地临时数据',
        },
        containerRestart: 'same Pod lifecycle only',
        podReplacement: 'not automatically preserved',
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

function validateTransitionCue(
  cue: TransitionCue,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): void {
  switch (cue.type) {
    case 'layout-transition':
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
      return;
    case 'scheduler-assignment':
      requireEntity(world, cue.schedulerId, cue);
      requireEntity(world, cue.podId, cue);
      requireEntity(world, cue.nodeId, cue);
      return;
    case 'counter-change': {
      const before = beforeWorld.entities[cue.entityId];
      const after = world.entities[cue.entityId];
      if (!before || !after) throw new Error(`counter-change target is not present in both worlds`);
      if (valueAtPath(before, cue.field) !== cue.from || valueAtPath(after, cue.field) !== cue.to) {
        throw new Error(`counter-change values contradict ${cue.field}`);
      }
      return;
    }
    case 'data-packet':
    case 'dns-query':
    case 'api-request':
      for (const id of cue.path) requireEntity(world, id, cue);
      return;
    case 'focus-camera':
    case 'container-failure':
    case 'container-restart':
    case 'callout':
      requireEntity(world, cue.entityId, cue);
  }
}

function validateTransition(
  transition: TransitionPlan,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): void {
  for (const cue of transition.cues) validateTransitionCue(cue, beforeWorld, world);
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
      validateTransition(transition, beforeWorld, world);
      compiledSteps.push(
        freezeValue({
          lessonId: lesson.id,
          stepId: authoredStep.id,
          index,
          beforeWorld,
          world,
          worldDiff: computeWorldDiff(beforeWorld, world),
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
