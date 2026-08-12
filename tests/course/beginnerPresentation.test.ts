import { describe, expect, it } from 'vitest';
import {
  chapterPresentation,
  componentExplanation,
  friendlyEntityName,
  viewPresentation,
} from '../../src/app/entityPresentation';
import { lessonById, scenarioById } from '../../src/content/loader';
import { beginnerProblemStageKindForStep } from '../../src/components/BeginnerProblemStage';
import { beginnerFocusedStep } from '../../src/course/beginnerProjection';
import { courseEngine } from '../../src/course/CourseEngine';
import type { WorldEntity } from '../../src/world/types';

function entity(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return {
    id: 'api-object:namespaced:shop:Pod:api-7f8d9-a',
    category: 'api-object',
    kind: 'Pod',
    name: 'api-7f8d9-a',
    namespace: 'shop',
    labels: { app: 'api' },
    status: 'ready',
    data: {},
    title: { en: 'api Pod', ja: 'api Pod', 'zh-CN': 'api Pod' },
    summary: { en: 'summary', ja: 'summary', 'zh-CN': 'summary' },
    sourceIds: ['k8s-pods'],
    visual: { archetype: 'pod' },
    ...overrides,
  };
}

describe('beginner presentation', () => {
  it('replaces generated object names with readable teaching names', () => {
    const pod = entity();
    expect(friendlyEntityName(pod, 'zh-CN')).toBe('api Pod A');
    expect(friendlyEntityName(pod, 'en')).toBe('api Pod A');
    expect(friendlyEntityName({ ...pod, status: 'pending', name: 'api-d-new' }, 'zh-CN')).toBe(
      '新建的 api Pod D',
    );
  });

  it('uses normal-language chapter and view titles', () => {
    expect(chapterPresentation('foundations', 'zh-CN')).toBe('基础篇');
    expect(viewPresentation('placement', 'zh-CN').title).toBe('应用运行层级');
    expect(viewPresentation('control-flow', 'en').title).toBe('Control flow');
  });

  it('uses simple problem diagrams before introducing the 3D control flow', () => {
    const stageKinds = [
      'image-packages-the-app',
      'declare-three-replicas',
      'three-replaceable-pods',
      'one-pod-is-lost',
      'controller-restores-count',
    ].map((stepId) =>
      beginnerProblemStageKindForStep({ lessonId: 'why-kubernetes-exists', stepId }),
    );
    expect(stageKinds).toEqual([
      'single-container',
      'manual-replicas',
      'desired-state',
      'replica-gap',
      'controller-loop',
    ]);
    expect(
      beginnerProblemStageKindForStep({
        lessonId: 'why-kubernetes-exists',
        stepId: 'scheduler-records-worker-c',
      }),
    ).toBeUndefined();
  });

  it('explains responsibility, mechanism, and non-responsibility for key components', () => {
    const controller = entity({
      id: 'runtime-component:cluster:global:ControllerManager:kube-controller-manager',
      category: 'runtime-component',
      kind: 'ControllerManager',
      name: 'kube-controller-manager',
      visual: { archetype: 'control-plane' },
    });
    const explanation = componentExplanation(controller, 'zh-CN');
    expect(explanation?.responsibility).toContain('期望的状态');
    expect(explanation?.mechanism).toContain('API Server');
    expect(explanation?.notResponsible).toContain('Scheduler');
  });

  it('keeps one causal route and labels every route participant in the beginner lesson', () => {
    const lesson = lessonById.get('why-kubernetes-exists');
    if (!lesson) throw new Error('missing beginner lesson');
    const scenario = scenarioById.get(lesson.scenarioId);
    if (!scenario) throw new Error('missing beginner scenario');
    const compiled = courseEngine.compileLesson(lesson, scenario);

    expect(compiled.steps).toHaveLength(9);
    for (const rawStep of compiled.steps) {
      const step = beginnerFocusedStep(rawStep);
      expect(step.view.activeRoutes.length).toBeLessThanOrEqual(1);
      expect(step.view.callouts).toHaveLength(0);
      if (step.view.activeRoutes.length === 0) continue;
      expect(Object.values(step.view.relationStates).filter((state) => state.visible)).toHaveLength(
        0,
      );
      for (const route of step.view.activeRoutes) {
        for (const hop of route.hops) {
          expect(step.view.entityStates[hop.fromEntityId]?.labelMode).not.toBe('none');
          expect(step.view.entityStates[hop.toEntityId]?.labelMode).not.toBe('none');
        }
      }
    }
  });
});
