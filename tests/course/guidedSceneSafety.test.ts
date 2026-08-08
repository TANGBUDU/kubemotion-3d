import { describe, expect, it } from 'vitest';
import { course, lessonById, lessons, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import type { LessonV2 } from '../../src/course/types';
import { createEffectiveScenePlan } from '../../src/renderer/scene-grammar';

const availableIds = new Set(
  course.lessons.filter((entry) => entry.status === 'available').map((entry) => entry.id),
);

describe('guided scene grammar safety', () => {
  it('keeps every available guided step within its grammar and hierarchy contracts', () => {
    for (const lesson of lessons.filter((candidate) => availableIds.has(candidate.id))) {
      const scenario = scenarioById.get(lesson.scenarioId);
      if (!scenario) throw new Error(`Missing scenario ${lesson.scenarioId}`);
      const compiled = courseEngine.compileLesson(lesson, scenario);

      for (const step of compiled.steps) {
        const plan = createEffectiveScenePlan(step.world, step.view, {
          viewport: 'desktop',
          applyGrammarDefaults: false,
        });
        expect(plan.projection).toEqual(step.view);
        expect(plan.primaryEntityIds.length).toBeLessThanOrEqual(
          plan.densityBudget.maxPrimaryEntities,
        );
        expect(plan.secondaryEntityIds.length).toBeLessThanOrEqual(
          plan.densityBudget.maxSecondaryEntities,
        );
        expect(plan.visibleRelationFamilies.length).toBeLessThanOrEqual(
          plan.densityBudget.maxRelationFamilies,
        );

        const visible = new Set(plan.visibleEntityIds);
        const focused = Object.values(step.view.entityStates).filter(
          (state) => state.visible && state.emphasis === 'focused',
        );
        const labelled = Object.values(step.view.entityStates).filter(
          (state) => state.visible && state.labelMode !== 'none',
        );
        expect(focused.length).toBeLessThanOrEqual(plan.densityBudget.maxFocusedEntities);
        expect(labelled.length).toBeLessThanOrEqual(plan.densityBudget.maxEntityLabels);

        for (const callout of step.view.callouts) expect(visible.has(callout.entityId)).toBe(true);
        for (const relationId of plan.visibleRelationIds) {
          const relation = step.world.relations[relationId];
          if (!relation) throw new Error(`Missing visible relation ${relationId}`);
          expect(visible.has(relation.from)).toBe(true);
          expect(visible.has(relation.to)).toBe(true);
        }
        for (const route of step.view.activeRoutes) {
          for (const hop of route.hops) {
            for (const endpoint of [hop.fromEntityId, hop.toEntityId]) {
              if (step.world.entities[endpoint]) expect(visible.has(endpoint)).toBe(true);
              else expect(step.beforeWorld.entities[endpoint]).toBeDefined();
            }
          }
        }

        for (const relation of Object.values(step.world.relations)) {
          const physicalPlacement =
            (step.view.view === 'placement' || step.view.view === 'control-flow') &&
            relation.semantic === 'placement';
          if (relation.semantic === 'composition' && visible.has(relation.to)) {
            expect(visible.has(relation.from)).toBe(true);
          }
          if (physicalPlacement && visible.has(relation.from)) {
            expect(visible.has(relation.to)).toBe(true);
          }
        }

        expect(plan.visibleEntityIds.length).toBeLessThan(Object.keys(step.world.entities).length);
      }
    }
  });

  it('fails closed when authored content requests a universal Overview without reset', () => {
    const source = lessonById.get('service-routes-to-pods');
    const scenario = scenarioById.get('service-routes-to-pods');
    if (!source || !scenario) throw new Error('Service fixture is missing');
    const firstStep = source.steps[0];
    if (!firstStep) throw new Error('Service entry step is missing');

    const unsafeLesson: LessonV2 = {
      ...source,
      id: 'grammar-safety-universal-overview',
      baseView: {
        view: 'overview',
        cameraPresetId: 'overview',
        entityRules: [
          {
            selector: { byCategory: 'api-object' },
            visible: true,
            emphasis: 'normal',
            labelMode: 'full',
          },
        ],
        relationRules: [{ visible: true }],
      },
      steps: [
        {
          ...firstStep,
          id: 'unsafe-entry',
          viewPatch: { view: 'overview', cameraPresetId: 'overview' },
          transition: { cues: [] },
        },
      ],
    };

    const step = courseEngine.compileLesson(unsafeLesson, scenario).steps[0];
    if (!step) throw new Error('Compiled safety step is missing');
    const visibleKinds = Object.values(scenario.entities)
      .filter((entity) => step.view.entityStates[entity.id]?.visible)
      .map((entity) => entity.kind);
    expect(visibleKinds).toEqual(['Pod', 'Pod', 'Pod', 'Pod']);
    expect(visibleKinds).not.toContain('Service');
    expect(visibleKinds).not.toContain('EndpointSlice');
  });
});
