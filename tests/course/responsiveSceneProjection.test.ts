import { describe, expect, it } from 'vitest';
import {
  flowStoryById,
  lessonById,
  scenario,
  scenarioById,
  sources,
} from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { flowStoryEngine } from '../../src/course/FlowStoryEngine';
import {
  createExploreProjection,
  createExploreScenePlan,
} from '../../src/course/exploreProjection';
import { calculateLayout } from '../../src/renderer/LayoutEngine';

const emptyFilters = { query: '', kind: '', namespace: '', status: '' } as const;

describe('viewport-responsive scene projection', () => {
  it('keeps the existing Explore API desktop-compatible', () => {
    expect(createExploreProjection(scenario, 'control-flow', emptyFilters)).toEqual(
      createExploreScenePlan(scenario, 'control-flow', emptyFilters, 'desktop').projection,
    );
  });

  it('deterministically applies mobile entity, relation, label, and layout projection', () => {
    const desktop = createExploreScenePlan(scenario, 'control-flow', emptyFilters, 'desktop');
    const mobile = createExploreScenePlan(scenario, 'control-flow', emptyFilters, 'mobile');
    const repeatedMobile = createExploreScenePlan(scenario, 'control-flow', emptyFilters, 'mobile');

    expect(repeatedMobile).toEqual(mobile);
    expect(desktop.viewport).toBe('desktop');
    expect(mobile.viewport).toBe('mobile');
    expect(mobile.layoutAlgorithm).toBe('api-causality');
    expect(mobile.zones.map((zone) => zone.id)).toEqual([
      'external-actor',
      'api-control-plane',
      'focused-runtime',
    ]);
    expect(mobile.visibleEntityIds.length).toBeLessThan(desktop.visibleEntityIds.length);
    expect(mobile.visibleRelationIds.length).toBeLessThan(desktop.visibleRelationIds.length);
    expect(
      Object.values(mobile.projection.entityStates).filter(
        (state) => state.visible && state.labelMode !== 'none',
      ),
    ).toHaveLength(3);

    const desktopLayout = calculateLayout({ world: scenario, view: desktop.projection });
    const mobileLayout = calculateLayout({ world: scenario, view: mobile.projection });
    expect(mobileLayout.entities.size).toBeLessThan(desktopLayout.entities.size);
    expect([...mobileLayout.entities.keys()].sort()).toEqual(mobile.visibleEntityIds);
  });

  it('compiles the same authored guided lesson for either viewport without mutation', () => {
    const lesson = lessonById.get('container-restart-vs-pod-replacement');
    const lessonScenario = scenarioById.get('container-restart-golden');
    if (!lesson || !lessonScenario) throw new Error('Responsive course fixtures are missing');

    const implicitDesktop = courseEngine.compileLesson(lesson, lessonScenario);
    const mobile = courseEngine.compileLesson(lesson, lessonScenario, { viewport: 'mobile' });
    const explicitDesktop = courseEngine.compileLesson(lesson, lessonScenario, {
      viewport: 'desktop',
    });

    expect(explicitDesktop).toEqual(implicitDesktop);
    expect(courseEngine.compileLesson(lesson, lessonScenario, { viewport: 'mobile' })).toEqual(
      mobile,
    );
    expect(mobile.lesson).toEqual(implicitDesktop.lesson);
    expect(mobile.steps).toHaveLength(implicitDesktop.steps.length);

    const changedSteps = mobile.steps.filter((step, index) => {
      const desktopStep = implicitDesktop.steps[index];
      return (
        desktopStep !== undefined &&
        JSON.stringify(step.view.entityStates) !== JSON.stringify(desktopStep.view.entityStates)
      );
    });
    expect(changedSteps.length).toBeGreaterThan(0);
    for (const step of mobile.steps) {
      expect(
        Object.values(step.view.entityStates).filter(
          (state) => state.visible && state.labelMode !== 'none',
        ).length,
      ).toBeLessThanOrEqual(3);
    }

    const nodeId = 'infrastructure:cluster:global:Node:worker-a';
    const kubeletId = 'runtime-component:node:worker-a:Kubelet:kubelet';
    for (const compiledLesson of [implicitDesktop, mobile]) {
      const restarted = compiledLesson.steps.find((step) => step.stepId === 'container-restarted');
      if (!restarted) throw new Error('Container restart step is missing');
      expect(restarted.view.entityStates[nodeId]).toMatchObject({ visible: true });
      expect(restarted.view.entityStates[kubeletId]).toMatchObject({ visible: true });
      expect(() => calculateLayout({ world: restarted.world, view: restarted.view })).not.toThrow();
    }

    const story = flowStoryById.get('container-restart-vs-pod-replacement');
    if (!story) throw new Error('Container restart Flow Story is missing');
    for (const viewport of ['desktop', 'mobile'] as const) {
      const compiledStory = flowStoryEngine.compileStory(
        story,
        { lessons: lessonById, scenarios: scenarioById, sources },
        { viewport },
      );
      const restartBeat = compiledStory.beats.find(
        (beat) => beat.beat.id === 'local-container-restart',
      );
      if (!restartBeat) throw new Error('Local container restart beat is missing');
      expect(restartBeat.compiledStep.view.entityStates[nodeId]).toMatchObject({ visible: true });
      expect(restartBeat.compiledStep.view.entityStates[kubeletId]).toMatchObject({
        visible: true,
      });
      expect(() =>
        calculateLayout({
          world: restartBeat.compiledStep.world,
          view: restartBeat.compiledStep.view,
        }),
      ).not.toThrow();
    }

    const direct = courseEngine.compileDirect(lesson, lessonScenario, 0, {
      viewport: 'mobile',
    });
    expect(direct).toEqual(mobile.steps[0]);
  });
});
