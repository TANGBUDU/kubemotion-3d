import { deepFreeze } from '../world';
import type { EntityId, WorldSnapshot } from '../world/types';
import type { CourseCompilationOptions } from './CourseEngine';
import { courseEngine } from './CourseEngine';
import type {
  ActiveTeachingRoute,
  CompiledFlowStory,
  CompiledFlowStoryBeat,
  CompiledStep,
  FlowStory,
  LessonV2,
  SourceEntry,
  TransitionCue,
} from './types';

export interface FlowStoryCatalog {
  readonly lessons: ReadonlyMap<string, LessonV2>;
  readonly scenarios: ReadonlyMap<string, WorldSnapshot>;
  readonly sources: ReadonlyMap<string, SourceEntry>;
}

type LessonCompiler = Pick<typeof courseEngine, 'compileLesson'>;

function duplicateIds(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function addCueEntityIds(relevant: Set<EntityId>, cue: TransitionCue): void {
  const add = (value: unknown) => {
    if (typeof value === 'string') relevant.add(value);
  };
  if ('entityId' in cue) add(cue.entityId);
  if ('fromEntityId' in cue) add(cue.fromEntityId);
  if ('toEntityId' in cue) add(cue.toEntityId);
  if ('schedulerId' in cue) add(cue.schedulerId);
  if ('podId' in cue) add(cue.podId);
  if ('nodeId' in cue) add(cue.nodeId);
}

/**
 * A Story keeps the complete factual lesson history but reduces its visual projection to the
 * current causal beat. The full lesson remains the place for surrounding architecture context.
 */
function focusStoryStep(
  compiledStep: CompiledStep,
  routes: readonly ActiveTeachingRoute[],
): CompiledStep {
  const relevant = new Set<EntityId>(compiledStep.evidence.map((row) => row.entityId));
  const routeIds = new Set(routes.map((route) => route.id));

  for (const route of routes) {
    for (const hop of route.hops) {
      relevant.add(hop.fromEntityId);
      relevant.add(hop.toEntityId);
    }
    if (route.support) {
      relevant.add(route.support.serviceId);
      relevant.add(route.support.endpointSliceId);
      relevant.add(route.support.selectedEndpointTargetId);
    }
  }

  for (const [entityId, state] of Object.entries(compiledStep.view.entityStates)) {
    if (state.visible && state.emphasis === 'focused') relevant.add(entityId);
  }

  for (const cue of compiledStep.transition.cues) {
    if ('routeId' in cue && !routeIds.has(cue.routeId)) continue;
    addCueEntityIds(relevant, cue);
    if ('relationId' in cue) {
      const relation = compiledStep.world.relations[cue.relationId];
      if (relation) {
        relevant.add(relation.from);
        relevant.add(relation.to);
      }
    }
  }

  if (relevant.size === 0) {
    for (const [entityId, state] of Object.entries(compiledStep.view.entityStates)) {
      if (state.visible) relevant.add(entityId);
    }
  }

  // Keep structural parents only when the focused visual cannot stand alone.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const entityId of [...relevant]) {
      const entity = compiledStep.world.entities[entityId];
      if (!entity || (entity.kind !== 'Kubelet' && entity.kind !== 'ContainerRuntime')) continue;
      const nodeName = typeof entity.data.nodeName === 'string' ? entity.data.nodeName : undefined;
      if (!nodeName) continue;
      const node = Object.values(compiledStep.world.entities).find(
        (candidate) => candidate.kind === 'Node' && candidate.name === nodeName,
      );
      if (node && !relevant.has(node.id)) {
        relevant.add(node.id);
        expanded = true;
      }
    }
    for (const relation of Object.values(compiledStep.world.relations)) {
      if (relation.semantic === 'composition' && relevant.has(relation.to)) {
        const size = relevant.size;
        relevant.add(relation.from);
        expanded ||= relevant.size !== size;
      }
      if (
        compiledStep.view.view === 'placement' &&
        relation.type === 'scheduled-on' &&
        relevant.has(relation.from)
      ) {
        const size = relevant.size;
        relevant.add(relation.to);
        expanded ||= relevant.size !== size;
      }
      if (relation.type === 'implemented-by') {
        const from = compiledStep.world.entities[relation.from];
        const to = compiledStep.world.entities[relation.to];
        if (relevant.has(relation.from) && to?.kind === 'Node') {
          const size = relevant.size;
          relevant.add(relation.to);
          expanded ||= relevant.size !== size;
        }
        if (relevant.has(relation.to) && from?.kind === 'Node') {
          const size = relevant.size;
          relevant.add(relation.from);
          expanded ||= relevant.size !== size;
        }
      }
    }
  }

  const entityStates = Object.fromEntries(
    Object.entries(compiledStep.view.entityStates).map(([entityId, state]) => {
      const visible = state.visible && relevant.has(entityId);
      return [
        entityId,
        visible
          ? state
          : {
              ...state,
              visible: false,
              emphasis: 'hidden' as const,
              labelMode: 'none' as const,
              inspectorMode: 'none' as const,
            },
      ];
    }),
  );

  const relationStates = Object.fromEntries(
    Object.entries(compiledStep.view.relationStates).map(([relationId, state]) => {
      const relation = compiledStep.world.relations[relationId];
      const visible = Boolean(
        state.visible && relation && relevant.has(relation.from) && relevant.has(relation.to),
      );
      return [relationId, visible ? state : { ...state, visible: false }];
    }),
  );

  return {
    ...compiledStep,
    view: {
      ...compiledStep.view,
      entityStates,
      relationStates,
      callouts: compiledStep.view.callouts.filter((callout) => relevant.has(callout.entityId)),
      activeRoutes: routes,
    },
  };
}

/**
 * Resolves authored flow stories onto compiled lesson history. Stories never
 * replay isolated patches: the complete lesson is compiled once, in order,
 * before its selected teaching beats and persistent routes are projected.
 */
export class FlowStoryEngine {
  constructor(private readonly lessonCompiler: LessonCompiler = courseEngine) {}

  compileStory(
    story: FlowStory,
    catalog: FlowStoryCatalog,
    options: CourseCompilationOptions = {},
  ): CompiledFlowStory {
    const lesson = catalog.lessons.get(story.lessonId);
    if (!lesson) {
      throw new Error(`Flow story ${story.id} references missing lesson: ${story.lessonId}`);
    }
    const scenario = catalog.scenarios.get(story.scenarioId);
    if (!scenario) {
      throw new Error(`Flow story ${story.id} references missing scenario: ${story.scenarioId}`);
    }
    if (lesson.scenarioId !== story.scenarioId) {
      throw new Error(
        `Flow story ${story.id} scenario ${story.scenarioId} does not match lesson ${lesson.id} scenario ${lesson.scenarioId}`,
      );
    }
    for (const sourceId of story.sourceIds) {
      if (!catalog.sources.has(sourceId)) {
        throw new Error(`Flow story ${story.id} references missing source: ${sourceId}`);
      }
    }

    const duplicateBeatIds = duplicateIds(story.beats.map((beat) => beat.id));
    if (duplicateBeatIds.length > 0) {
      throw new Error(`Flow story ${story.id} has duplicate beat ID: ${duplicateBeatIds[0]}`);
    }
    const duplicateStepIds = duplicateIds(story.beats.map((beat) => beat.stepId));
    if (duplicateStepIds.length > 0) {
      throw new Error(
        `Flow story ${story.id} references lesson step more than once: ${duplicateStepIds[0]}`,
      );
    }

    // Compile the complete lesson before selecting any story beat. This is the
    // causality boundary: later beats receive every preceding world patch.
    const compiledLesson = this.lessonCompiler.compileLesson(lesson, scenario, options);
    const lessonStepById = new Map(lesson.steps.map((step) => [step.id, step]));
    const compiledStepById = new Map(compiledLesson.steps.map((step) => [step.stepId, step]));
    let previousStepIndex = -1;
    let referencedRouteCount = 0;

    const beats: CompiledFlowStoryBeat[] = story.beats.map((beat) => {
      const lessonStep = lessonStepById.get(beat.stepId);
      const compiledStep = compiledStepById.get(beat.stepId);
      if (!lessonStep || !compiledStep) {
        throw new Error(
          `Flow story ${story.id} beat ${beat.id} references missing lesson step: ${beat.stepId}`,
        );
      }
      if (compiledStep.index <= previousStepIndex) {
        throw new Error(
          `Flow story ${story.id} beats must follow lesson step order; ${beat.stepId} is out of order`,
        );
      }
      previousStepIndex = compiledStep.index;

      const duplicateRouteIds = duplicateIds(beat.routeIds);
      if (duplicateRouteIds.length > 0) {
        throw new Error(
          `Flow story ${story.id} beat ${beat.id} has duplicate route ID: ${duplicateRouteIds[0]}`,
        );
      }
      const activeRouteById = new Map(
        compiledStep.view.activeRoutes.map((route) => [route.id, route]),
      );
      const routes = beat.routeIds.map((routeId) => {
        const route = activeRouteById.get(routeId);
        if (!route) {
          throw new Error(
            `Flow story ${story.id} beat ${beat.id} references missing route ${routeId} on lesson step ${beat.stepId}`,
          );
        }
        return route;
      });
      referencedRouteCount += routes.length;
      const selectedRoute = beat.selectedRouteId
        ? activeRouteById.get(beat.selectedRouteId)
        : undefined;
      if (beat.selectedRouteId && !beat.routeIds.includes(beat.selectedRouteId)) {
        throw new Error(
          `Flow story ${story.id} beat ${beat.id} selects route ${beat.selectedRouteId} without referencing it`,
        );
      }
      if (beat.selectedRouteId && !selectedRoute) {
        throw new Error(
          `Flow story ${story.id} beat ${beat.id} selects missing route ${beat.selectedRouteId}`,
        );
      }
      const storyStep = focusStoryStep(compiledStep, routes);
      return selectedRoute
        ? { beat, lessonStep, compiledStep: storyStep, routes, selectedRoute }
        : { beat, lessonStep, compiledStep: storyStep, routes };
    });

    if (referencedRouteCount === 0) {
      throw new Error(`Flow story ${story.id} must reference at least one persistent route`);
    }

    return deepFreeze({ story, compiledLesson, beats }) as unknown as CompiledFlowStory;
  }

  compileStories(
    stories: readonly FlowStory[],
    catalog: FlowStoryCatalog,
    options: CourseCompilationOptions = {},
  ): readonly CompiledFlowStory[] {
    const duplicateStoryIds = duplicateIds(stories.map((story) => story.id));
    if (duplicateStoryIds.length > 0) {
      throw new Error(`Duplicate flow story ID: ${duplicateStoryIds[0]}`);
    }
    return deepFreeze(stories.map((story) => this.compileStory(story, catalog, options)));
  }
}

export const flowStoryEngine = new FlowStoryEngine();
