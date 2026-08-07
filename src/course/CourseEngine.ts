import type { ClusterGraph, EntityId, RelationId } from '../domain/types';
import { selectEntities } from './selectors';
import type {
  CompiledLesson,
  EntityProjection,
  Lesson,
  SceneProjection,
  SceneProjectionPatch,
  TransitionCue,
} from './types';

function initialProjection(graph: ClusterGraph): SceneProjection {
  return {
    view: 'overview',
    cameraPresetId: 'overview',
    entityStates: Object.fromEntries(
      graph.snapshot.entities.map((entity) => [
        entity.id,
        { visible: true, emphasis: 'normal', labelMode: 'short' } satisfies EntityProjection,
      ]),
    ) as Record<EntityId, EntityProjection>,
    relationStates: Object.fromEntries(
      graph.snapshot.relations.map((relation) => [
        relation.id,
        { visible: false, emphasis: 'normal' as const },
      ]),
    ) as Record<RelationId, { visible: boolean; emphasis: 'normal' | 'focused' | 'dimmed' }>,
    callouts: [],
  };
}

export function applyProjectionPatch(
  previous: SceneProjection,
  patch: SceneProjectionPatch,
  graph: ClusterGraph,
): SceneProjection {
  const entityStates: Record<EntityId, EntityProjection> = { ...previous.entityStates };
  if (patch.resetEntities) {
    for (const id of Object.keys(entityStates) as EntityId[]) {
      entityStates[id] = { visible: false, emphasis: 'hidden', labelMode: 'none' };
    }
  }
  for (const rule of patch.entityRules ?? []) {
    const matches = selectEntities(graph, rule.selector);
    if (matches.length === 0 && !rule.allowEmpty) {
      throw new Error(`Entity selector matched nothing: ${JSON.stringify(rule.selector)}`);
    }
    for (const entity of matches) {
      const current = entityStates[entity.id] ?? { visible: true, emphasis: 'normal' as const };
      entityStates[entity.id] = {
        ...current,
        ...(rule.visible === undefined ? {} : { visible: rule.visible }),
        ...(rule.emphasis === undefined ? {} : { emphasis: rule.emphasis }),
        ...(rule.statusOverride === undefined ? {} : { statusOverride: rule.statusOverride }),
        ...(rule.labelMode === undefined ? {} : { labelMode: rule.labelMode }),
      };
    }
  }
  const relationStates = { ...previous.relationStates };
  for (const rule of patch.relationRules ?? []) {
    const matches = graph.snapshot.relations.filter(
      (relation) =>
        (!rule.byType || relation.type === rule.byType) &&
        (!rule.byIds || rule.byIds.includes(relation.id)),
    );
    if (matches.length === 0 && !rule.allowEmpty)
      throw new Error('Relation selector matched nothing');
    for (const relation of matches) {
      const current = relationStates[relation.id] ?? {
        visible: false,
        emphasis: 'normal' as const,
      };
      relationStates[relation.id] = {
        ...current,
        ...(rule.visible === undefined ? {} : { visible: rule.visible }),
        ...(rule.emphasis === undefined ? {} : { emphasis: rule.emphasis }),
      };
    }
  }
  return {
    view: patch.view ?? previous.view,
    cameraPresetId: patch.cameraPresetId ?? previous.cameraPresetId,
    entityStates,
    relationStates,
    callouts: patch.callouts ?? previous.callouts,
  };
}

function validateTransitions(transitions: readonly TransitionCue[], graph: ClusterGraph): void {
  for (const cue of transitions) {
    if ('path' in cue) {
      for (const id of cue.path) {
        const entity = graph.entityById.get(id);
        if (!entity) throw new Error(`Transition references missing entity: ${id}`);
        const allowed =
          cue.type === 'data-packet'
            ? entity.semantics.participatesInDataPath
            : entity.semantics.participatesInControlPath;
        if (!allowed) throw new Error(`${cue.type} path is semantically invalid at ${id}`);
      }
    } else if ('entityId' in cue && !graph.entityById.has(cue.entityId)) {
      throw new Error(`Transition references missing entity: ${cue.entityId}`);
    } else if (
      'relationId' in cue &&
      !graph.snapshot.relations.some((r) => r.id === cue.relationId)
    ) {
      throw new Error(`Transition references missing relation: ${cue.relationId}`);
    }
  }
}

export const courseEngine = {
  compileLesson(lesson: Lesson, graph: ClusterGraph): CompiledLesson {
    let projection = applyProjectionPatch(initialProjection(graph), lesson.baseProjection, graph);
    const projections: SceneProjection[] = [];
    const transitions: (readonly TransitionCue[])[] = [];
    for (const step of lesson.steps) {
      projection = applyProjectionPatch(projection, step.projectionPatch, graph);
      validateTransitions(step.transition, graph);
      projections.push(structuredClone(projection));
      transitions.push(structuredClone(step.transition));
    }
    return { lesson, projections, transitions };
  },
  getProjection(compiled: CompiledLesson, stepIndex: number): SceneProjection {
    const projection = compiled.projections[stepIndex];
    if (!projection) throw new Error(`Invalid lesson step: ${stepIndex}`);
    return projection;
  },
  getTransition(compiled: CompiledLesson, stepIndex: number): readonly TransitionCue[] {
    const transition = compiled.transitions[stepIndex];
    if (!transition) throw new Error(`Invalid lesson step: ${stepIndex}`);
    return transition;
  },
};
