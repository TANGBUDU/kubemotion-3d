import type { CourseCompilationOptions } from './CourseEngine';
import { courseEngine } from './CourseEngine';
import type {
  CompiledFlowStory,
  CompiledFlowStoryBeat,
  FlowStory,
  LessonV2,
  SourceEntry,
} from './types';
import { deepFreeze } from '../world';
import type { WorldSnapshot } from '../world/types';

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
      return selectedRoute
        ? { beat, lessonStep, compiledStep, routes, selectedRoute }
        : { beat, lessonStep, compiledStep, routes };
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
