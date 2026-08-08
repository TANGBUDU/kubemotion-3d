import { describe, expect, it, vi } from 'vitest';
import {
  compiledFlowStories,
  flowStories,
  flowStoryById,
  lessonById,
  scenarioById,
  sources,
} from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { FlowStoryEngine } from '../../src/course/FlowStoryEngine';
import type { FlowStory, FlowStoryBeat } from '../../src/course/types';

const catalog = { lessons: lessonById, scenarios: scenarioById, sources };

function story(id: string): FlowStory {
  const result = flowStoryById.get(id);
  if (!result) throw new Error(`Missing fixture flow story: ${id}`);
  return result;
}

function withoutSelectedRoute(beat: FlowStoryBeat, routeIds: readonly string[]): FlowStoryBeat {
  return { id: beat.id, stepId: beat.stepId, routeIds };
}

describe('FlowStoryEngine', () => {
  it('loads exactly the eight mandatory stories with the required priorities and lesson targets', () => {
    expect(flowStories.map((item) => item.id)).toEqual([
      'manifest-to-running-pod',
      'internal-service-request',
      'dns-and-service-discovery',
      'container-restart-vs-pod-replacement',
      'readiness-failure-and-traffic-shift',
      'rolling-update-traffic-shift',
      'external-browser-request',
      'hpa-scale-out',
    ]);
    expect(flowStories.slice(0, 4).every((item) => item.priority === 'P0')).toBe(true);
    expect(flowStories.slice(4).every((item) => item.priority === 'P1')).toBe(true);
    expect(story('external-browser-request').lessonId).toBe('full-external-request');
    expect(story('hpa-scale-out').lessonId).toBe('hpa');
    for (const item of flowStories) {
      expect(lessonById.has(item.lessonId)).toBe(true);
      expect(scenarioById.has(item.scenarioId)).toBe(true);
      for (const field of [item.title, item.summary, item.outcome]) {
        expect(field.en.length).toBeGreaterThan(0);
        expect(field.ja.length).toBeGreaterThan(0);
        expect(field['zh-CN'].length).toBeGreaterThan(0);
      }
    }
  });

  it('compiles the whole lesson once before projecting ordered story beats', () => {
    const compileLesson = vi.fn(courseEngine.compileLesson.bind(courseEngine));
    const engine = new FlowStoryEngine({ compileLesson });
    const authored = story('readiness-failure-and-traffic-shift');
    const compiled = engine.compileStory(authored, catalog);
    const lesson = lessonById.get(authored.lessonId);
    if (!lesson) throw new Error(`Missing fixture lesson: ${authored.lessonId}`);

    expect(compileLesson).toHaveBeenCalledTimes(1);
    expect(compiled.compiledLesson.steps).toHaveLength(lesson.steps.length);
    expect(compiled.beats.map((beat) => beat.compiledStep.stepId)).toEqual(
      authored.beats.map((beat) => beat.stepId),
    );
    expect(compiled.beats.map((beat) => beat.compiledStep.index)).toEqual([3, 4, 5]);
    expect(compiled.beats[0]?.compiledStep.beforeWorld).toEqual(
      compiled.compiledLesson.steps[2]?.world,
    );
  });

  it('resolves every authored route on its ordered lesson step', () => {
    expect(compiledFlowStories).toHaveLength(8);
    for (const compiled of compiledFlowStories) {
      let previousIndex = -1;
      let routeCount = 0;
      for (const beat of compiled.beats) {
        expect(beat.compiledStep.index).toBeGreaterThan(previousIndex);
        previousIndex = beat.compiledStep.index;
        expect(beat.routes.map((route) => route.id)).toEqual(beat.beat.routeIds);
        expect(beat.routes.every((route) => route.persistAfterAnimation)).toBe(true);
        routeCount += beat.routes.length;
        if (beat.beat.selectedRouteId) {
          expect(beat.selectedRoute?.id).toBe(beat.beat.selectedRouteId);
        }
      }
      expect(routeCount).toBeGreaterThan(0);
      expect(Object.isFrozen(compiled)).toBe(true);
      expect(Object.isFrozen(compiled.beats)).toBe(true);
    }
  });

  it('rejects missing lesson, scenario, source, step, and route references', () => {
    const engine = new FlowStoryEngine();
    const authored = story('manifest-to-running-pod');

    expect(() => engine.compileStory({ ...authored, lessonId: 'missing-lesson' }, catalog)).toThrow(
      'references missing lesson',
    );
    expect(() =>
      engine.compileStory({ ...authored, scenarioId: 'missing-scenario' }, catalog),
    ).toThrow('references missing scenario');
    expect(() =>
      engine.compileStory({ ...authored, sourceIds: ['missing-source'] }, catalog),
    ).toThrow('references missing source');
    expect(() =>
      engine.compileStory(
        {
          ...authored,
          beats: [{ ...authored.beats[0]!, stepId: 'missing-step' }],
        },
        catalog,
      ),
    ).toThrow('references missing lesson step');
    expect(() =>
      engine.compileStory(
        {
          ...authored,
          beats: [withoutSelectedRoute(authored.beats[0]!, ['missing-route'])],
        },
        catalog,
      ),
    ).toThrow('references missing route');
  });

  it('rejects duplicate, out-of-order, and route-free story beats', () => {
    const engine = new FlowStoryEngine();
    const authored = story('manifest-to-running-pod');

    expect(() =>
      engine.compileStory(
        { ...authored, beats: [authored.beats[0]!, authored.beats[0]!] },
        catalog,
      ),
    ).toThrow('duplicate beat ID');
    expect(() =>
      engine.compileStory(
        { ...authored, beats: [authored.beats[1]!, authored.beats[0]!] },
        catalog,
      ),
    ).toThrow('must follow lesson step order');
    expect(() =>
      engine.compileStory(
        {
          ...authored,
          beats: [withoutSelectedRoute(authored.beats.at(-1)!, [])],
        },
        catalog,
      ),
    ).toThrow('must reference at least one persistent route');
  });
});
