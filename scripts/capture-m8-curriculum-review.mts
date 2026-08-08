/// <reference lib="dom" />

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page, type ViewportSize } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';
import { lessonV2Schema, scenarioV2AuthorSchema } from '../src/content/schemas';
import { courseEngine } from '../src/course/CourseEngine';
import type { CompiledLesson, ComparisonPanelModel, LessonV2 } from '../src/course/types';
import { validateWorldSnapshot } from '../src/world/validation';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m8');
const coursePath = path.resolve('content/courses/kubernetes-foundations/course.yaml');
const lessonDirectory = path.resolve('content/courses/kubernetes-foundations/lessons');
const scenarioDirectory = path.resolve('content/scenarios');
const MOBILE_BREAKPOINT = 720;
const MAXIMUM_TOKEN_ROUTE_DISTANCE = 0.02;
const GEOMETRY_TOLERANCE_PX = 0.75;
const MINIMUM_SETTLED_CASES = 36;
const MINIMUM_REDUCED_MOTION_CASES = 12;

type Locale = 'en' | 'ja' | 'zh-CN';
type LessonId =
  | 'why-kubernetes-exists'
  | 'cluster-overview'
  | 'pod-and-container'
  | 'pod-and-placement'
  | 'deployment-replicaset-and-pods'
  | 'manifest-to-running-pod'
  | 'pending-and-scheduling'
  | 'container-restart-vs-pod-replacement'
  | 'labels-and-selectors'
  | 'service-routes-to-pods'
  | 'dns-and-service-discovery'
  | 'probes-and-rolling-update';
type ViewMode = 'overview' | 'logical' | 'placement' | 'control-flow' | 'traffic' | 'storage';
type RouteSemantic = 'control' | 'scheduling' | 'node-runtime' | 'data-flow' | 'dns';
type Phase = 'settled' | 'reduced-motion';

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SceneDiagnostics {
  readonly cameraMode: 'orthographic' | 'perspective';
  readonly safeRectX: number;
  readonly safeRectY: number;
  readonly safeRectWidth: number;
  readonly safeRectHeight: number;
  readonly activeCameraTransitions: number;
  readonly routesOutsideSafeRect: number;
  readonly arrowheadsOutsideSafeRect: number;
  readonly routeMarkersOutsideSafeRect: number;
  readonly routeObstacleIntersections: number;
  readonly routeEndpointDriftCount: number;
  readonly activeRouteWidthsBelowMinimum: number;
  readonly visibleRoutesWithoutArrowheads: number;
  readonly flowTokensOffRoute: number;
  readonly maximumFlowTokenRouteDistance: number;
  readonly routeReplanFailures: number;
  readonly focusedEntitiesOutsideSafeRect: number;
  readonly sceneBoundsOutsideContentRect: number;
  readonly entityHandles: number;
  readonly relationHandles: number;
  readonly labels: number;
  readonly callouts: number;
  readonly foundationMeshes: number;
  readonly visibleNodes: number;
  readonly scheduledPods: number;
  readonly scheduledPodsOutsideBays: number;
  readonly duplicateBayAssignments: number;
  readonly podPairOverlaps: number;
  readonly podSystemModuleOverlaps: number;
  readonly pendingPods: number;
  readonly pendingPodsInsideNodes: number;
  readonly nodeHandles: number;
  readonly podHandles: number;
  readonly mountedKubelets: number;
  readonly mountedContainerRuntimes: number;
  readonly orphanKubelets: number;
  readonly orphanContainerRuntimes: number;
  readonly containedContainers: number;
  readonly containersOutsidePods: number;
  readonly activeAnimations: number;
  readonly retainedExitHandles: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly flowTokens: number;
  readonly routeMarkers: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
}

interface HierarchyMinimums {
  readonly nodes?: number;
  readonly pods?: number;
  readonly containedContainers?: number;
  readonly scheduledPods?: number;
  readonly pendingPods?: number;
}

interface ObjectiveDefinition {
  readonly id: string;
  readonly lessonId: LessonId;
  readonly stepId: string;
  readonly expectedView: ViewMode;
  readonly locales: readonly [Locale, Locale, Locale];
  readonly mediumHeight: 720 | 800;
  readonly route: boolean;
  readonly reducedMotion: boolean;
  readonly expectedRouteId?: string;
  readonly expectedRouteSemantic?: RouteSemantic;
  readonly presentation?: 'scene' | 'comparison';
  readonly desktopMinimumRelations: number;
  readonly mobileMinimumRelations?: number;
  readonly minimumFoundationMeshes?: number;
  readonly desktopHierarchy?: HierarchyMinimums;
  readonly mobileHierarchy?: HierarchyMinimums;
}

interface CaptureCase extends ObjectiveDefinition {
  readonly step: number;
  readonly viewportId: string;
  readonly viewport: ViewportSize;
  readonly locale: Locale;
  readonly expectedComparison?: ComparisonPanelModel;
}

interface DensityBudgetInspection {
  readonly viewportClass: 'desktop' | 'mobile';
  readonly maximumEntityHandles: number;
  readonly maximumEntityLabels: number;
  readonly maximumRouteLabels: number;
  readonly entityHandles: number;
  readonly visibleEntityLabels: number;
  readonly visibleRouteLabels: number;
  readonly focusedEntityRecords: readonly {
    readonly entityId: string;
    readonly hidden: boolean;
  }[];
  readonly visibleFocusedEntities: number;
}

interface ReducedMotionProbe {
  readonly samples: number;
  readonly maxFlowTokens: number;
  readonly minRouteHandles: number;
  readonly minArrowheads: number;
  readonly minRouteMarkers: number;
  readonly maxObstacleIntersections: number;
  readonly maxEndpointDrift: number;
  readonly maxReplanFailures: number;
  readonly maxOffRouteTokens: number;
  readonly maximumTokenRouteDistance: number;
}

interface RawCourse {
  readonly lessons?: readonly { readonly id?: string; readonly status?: string }[];
}

const lessonIds: readonly LessonId[] = [
  'why-kubernetes-exists',
  'cluster-overview',
  'pod-and-container',
  'pod-and-placement',
  'deployment-replicaset-and-pods',
  'manifest-to-running-pod',
  'pending-and-scheduling',
  'container-restart-vs-pod-replacement',
  'labels-and-selectors',
  'service-routes-to-pods',
  'dns-and-service-discovery',
  'probes-and-rolling-update',
];

const newlyPublishedLessonIds: readonly LessonId[] = [
  'why-kubernetes-exists',
  'pod-and-container',
  'deployment-replicaset-and-pods',
  'pending-and-scheduling',
  'labels-and-selectors',
  'dns-and-service-discovery',
  'probes-and-rolling-update',
];

const objectives: readonly ObjectiveDefinition[] = [
  {
    id: 'packaging-versus-orchestration',
    lessonId: 'why-kubernetes-exists',
    stepId: 'image-packages-the-app',
    expectedView: 'placement',
    locales: ['en', 'ja', 'zh-CN'],
    mediumHeight: 720,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 2,
    desktopHierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
  {
    id: 'cluster-foundation-summary',
    lessonId: 'cluster-overview',
    stepId: 'cluster-summary',
    expectedView: 'overview',
    locales: ['ja', 'zh-CN', 'en'],
    mediumHeight: 800,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 0,
    minimumFoundationMeshes: 1,
    desktopHierarchy: { nodes: 1 },
  },
  {
    id: 'two-containers-one-pod',
    lessonId: 'pod-and-container',
    stepId: 'two-containers-one-pod',
    expectedView: 'placement',
    locales: ['zh-CN', 'en', 'ja'],
    mediumHeight: 720,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 2,
    desktopHierarchy: { nodes: 1, pods: 1, containedContainers: 2, scheduledPods: 1 },
  },
  {
    id: 'node-runtime-chassis',
    lessonId: 'pod-and-placement',
    stepId: 'node-runtime-chassis',
    expectedView: 'placement',
    locales: ['en', 'zh-CN', 'ja'],
    mediumHeight: 800,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 2,
    desktopHierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
  {
    id: 'replicaset-owns-pod-slots',
    lessonId: 'deployment-replicaset-and-pods',
    stepId: 'replicaset-owns-pod-slots',
    expectedView: 'logical',
    locales: ['ja', 'en', 'zh-CN'],
    mediumHeight: 720,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 3,
    mobileMinimumRelations: 2,
    desktopHierarchy: { pods: 3 },
    mobileHierarchy: { pods: 2 },
  },
  {
    id: 'manifest-converges-ready',
    lessonId: 'manifest-to-running-pod',
    stepId: 'pod-becomes-ready',
    expectedView: 'placement',
    locales: ['zh-CN', 'ja', 'en'],
    mediumHeight: 800,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 1,
    desktopHierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
  {
    id: 'pending-pod-bound-to-worker-c',
    lessonId: 'pending-and-scheduling',
    stepId: 'bind-pod-to-worker-c',
    expectedView: 'control-flow',
    locales: ['en', 'ja', 'zh-CN'],
    mediumHeight: 720,
    route: true,
    reducedMotion: true,
    expectedRouteId: 'route-bind-schedule-demo',
    expectedRouteSemantic: 'scheduling',
    desktopMinimumRelations: 3,
    desktopHierarchy: { nodes: 1, pods: 1, scheduledPods: 1 },
  },
  {
    id: 'pod-and-container-identities',
    lessonId: 'container-restart-vs-pod-replacement',
    stepId: 'compare-identities',
    expectedView: 'control-flow',
    locales: ['ja', 'zh-CN', 'en'],
    mediumHeight: 800,
    route: false,
    reducedMotion: false,
    presentation: 'comparison',
    desktopMinimumRelations: 0,
  },
  {
    id: 'selector-excludes-one-pod',
    lessonId: 'labels-and-selectors',
    stepId: 'one-pod-no-longer-matches',
    expectedView: 'logical',
    locales: ['zh-CN', 'en', 'ja'],
    mediumHeight: 720,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 0,
    mobileMinimumRelations: 0,
    desktopHierarchy: { pods: 3 },
    mobileHierarchy: { pods: 2 },
  },
  {
    id: 'endpoint-slice-selection-evidence',
    lessonId: 'service-routes-to-pods',
    stepId: 'endpoint-slice-backends',
    expectedView: 'traffic',
    locales: ['en', 'zh-CN', 'ja'],
    mediumHeight: 800,
    route: false,
    reducedMotion: false,
    desktopMinimumRelations: 4,
    desktopHierarchy: { pods: 3 },
  },
  {
    id: 'dns-query-and-response',
    lessonId: 'dns-and-service-discovery',
    stepId: 'dns-query-and-response',
    expectedView: 'traffic',
    locales: ['ja', 'en', 'zh-CN'],
    mediumHeight: 720,
    route: true,
    reducedMotion: true,
    expectedRouteId: 'dns-client-kube-dns-coredns',
    expectedRouteSemantic: 'dns',
    desktopMinimumRelations: 2,
    desktopHierarchy: { pods: 2 },
  },
  {
    id: 'readiness-adds-ready-v2',
    lessonId: 'probes-and-rolling-update',
    stepId: 'readiness-adds-v2-endpoint',
    expectedView: 'traffic',
    locales: ['zh-CN', 'ja', 'en'],
    mediumHeight: 800,
    route: true,
    reducedMotion: true,
    expectedRouteId: 'ready-v2-request',
    expectedRouteSemantic: 'data-flow',
    desktopMinimumRelations: 4,
    desktopHierarchy: { pods: 3 },
  },
  {
    id: 'liveness-restarts-v2-container',
    lessonId: 'probes-and-rolling-update',
    stepId: 'liveness-restarts-container',
    expectedView: 'placement',
    locales: ['en', 'ja', 'zh-CN'],
    mediumHeight: 720,
    route: true,
    reducedMotion: true,
    expectedRouteId: 'kubelet-restarts-v2-container',
    expectedRouteSemantic: 'node-runtime',
    desktopMinimumRelations: 0,
    desktopHierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
];

const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const inside = (inner: Rectangle, outer: Rectangle, tolerance = GEOMETRY_TOLERANCE_PX): boolean =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance;

const intersectionArea = (left: Rectangle, right: Rectangle): number => {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  return width * height;
};

const readYaml = async (filePath: string): Promise<unknown> =>
  parse(await readFile(filePath, 'utf8'), { merge: true });

function focusedEntityIds(compiled: CompiledLesson): readonly (readonly string[])[] {
  return compiled.steps.map((step) =>
    Object.entries(step.view.entityStates)
      .filter(([, state]) => state.visible && state.emphasis === 'focused')
      .map(([entityId]) => entityId),
  );
}

async function resolveCaptures(): Promise<readonly CaptureCase[]> {
  const failures: string[] = [];
  const course = (await readYaml(coursePath)) as RawCourse;
  const availableIds = (course.lessons ?? [])
    .filter((entry) => entry.status === 'available' && entry.id)
    .map((entry) => entry.id as string);
  const missingLessons = lessonIds.filter((lessonId) => !availableIds.includes(lessonId));
  const unexpectedLessons = availableIds.filter(
    (lessonId) => !lessonIds.includes(lessonId as LessonId),
  );
  if (missingLessons.length > 0 || unexpectedLessons.length > 0) {
    failures.push(
      `available lesson set mismatch; missing=[${missingLessons.join(', ')}], unexpected=[${unexpectedLessons.join(', ')}]`,
    );
  }

  const bundles = new Map<
    LessonId,
    {
      readonly lesson: LessonV2;
      readonly desktop: CompiledLesson;
      readonly mobile: CompiledLesson;
    }
  >();

  for (const lessonId of lessonIds) {
    const lesson = lessonV2Schema.parse(
      await readYaml(path.join(lessonDirectory, `${lessonId}.yaml`)),
    ) as unknown as LessonV2;
    if (lesson.id !== lessonId) {
      failures.push(`${lessonId}: lesson id=${lesson.id}; expected filename id`);
    }
    const authoredScenario = scenarioV2AuthorSchema.parse(
      await readYaml(path.join(scenarioDirectory, `${lesson.scenarioId}.yaml`)),
    );
    const world = validateWorldSnapshot({
      schemaVersion: 2,
      scenarioId: authoredScenario.scenarioId,
      revision: authoredScenario.revision,
      entities: Object.fromEntries(authoredScenario.entities.map((entity) => [entity.id, entity])),
      relations: Object.fromEntries(
        authoredScenario.relations.map((relation) => [relation.id, relation]),
      ),
    });
    const desktop = courseEngine.compileLesson(lesson, world, { viewport: 'desktop' });
    const mobile = courseEngine.compileLesson(lesson, world, { viewport: 'mobile' });
    bundles.set(lessonId, { lesson, desktop, mobile });

    const desktopFocus = focusedEntityIds(desktop);
    const mobileFocus = focusedEntityIds(mobile);
    for (const [index, step] of desktop.steps.entries()) {
      const authoredStep = lesson.steps[index];
      if (!authoredStep) {
        failures.push(`${lessonId}/${step.stepId}: missing authored step`);
        continue;
      }
      if (desktopFocus[index]?.length !== 1 || mobileFocus[index]?.length !== 1) {
        failures.push(
          `${lessonId}/${step.stepId}: focus must resolve to exactly one entity on desktop and mobile`,
        );
      }
      if (authoredStep.evidence.mode === 'none' || authoredStep.evidence.entityIds.length === 0) {
        failures.push(`${lessonId}/${step.stepId}: factual Evidence is required`);
      }
      for (const [field, localized] of [
        ['What changed', authoredStep.teaching.whatChanged],
        ['Why', authoredStep.teaching.whyItHappened],
        ['Takeaway', authoredStep.teaching.takeaway],
      ] as const) {
        for (const locale of ['en', 'ja', 'zh-CN'] as const) {
          if (!localized[locale].trim()) {
            failures.push(`${lessonId}/${step.stepId}: ${field} is empty for ${locale}`);
          }
        }
      }
      for (const route of step.view.activeRoutes) {
        for (const hop of route.hops) {
          for (const entityId of [hop.fromEntityId, hop.toEntityId]) {
            const entity = step.world.entities[entityId] ?? step.beforeWorld.entities[entityId];
            if (entity?.kind === 'EndpointSlice' || entityId.includes(':EndpointSlice:')) {
              failures.push(
                `${lessonId}/${step.stepId}/${route.id}: EndpointSlice ${entityId} is a packet hop`,
              );
            }
          }
        }
      }
    }
  }

  const representedLessons = new Set(objectives.map((objective) => objective.lessonId));
  for (const lessonId of lessonIds) {
    if (!representedLessons.has(lessonId)) failures.push(`${lessonId}: no representative capture`);
  }
  for (const lessonId of newlyPublishedLessonIds) {
    if (!representedLessons.has(lessonId))
      failures.push(`${lessonId}: new M8 lesson lacks priority`);
  }

  const stepIndices = new Map<string, number>();
  const comparisonModels = new Map<string, ComparisonPanelModel>();
  for (const objective of objectives) {
    const bundle = bundles.get(objective.lessonId);
    if (!bundle) {
      failures.push(`${objective.lessonId}: bundle unavailable`);
      continue;
    }
    const stepIndex = bundle.lesson.steps.findIndex((step) => step.id === objective.stepId);
    if (stepIndex < 0) {
      failures.push(`${objective.lessonId}: missing representative step ${objective.stepId}`);
      continue;
    }
    stepIndices.set(`${objective.lessonId}:${objective.stepId}`, stepIndex);
    const compiledStep = bundle.desktop.steps[stepIndex];
    const mobileStep = bundle.mobile.steps[stepIndex];
    if (!compiledStep || !mobileStep) {
      failures.push(`${objective.lessonId}/${objective.stepId}: compiled step unavailable`);
      continue;
    }
    for (const [viewportClass, step] of [
      ['desktop', compiledStep],
      ['mobile', mobileStep],
    ] as const) {
      if (step.view.view !== objective.expectedView) {
        failures.push(
          `${objective.lessonId}/${objective.stepId}/${viewportClass}: view=${step.view.view}; expected ${objective.expectedView}`,
        );
      }
    }
    const expectsComparison = objective.presentation === 'comparison';
    if (expectsComparison) {
      for (const [viewportClass, comparison] of [
        ['desktop', compiledStep.view.comparison],
        ['mobile', mobileStep.view.comparison],
      ] as const) {
        if (!comparison) {
          failures.push(
            `${objective.lessonId}/${objective.stepId}/${viewportClass}: comparison model is missing`,
          );
          continue;
        }
        if (comparison.rows.length < 6) {
          failures.push(
            `${objective.lessonId}/${objective.stepId}/${viewportClass}: comparison rows=${String(comparison.rows.length)}; expected >=6`,
          );
        }
        for (const locale of ['en', 'ja', 'zh-CN'] as const) {
          if (!comparison.title[locale].trim()) {
            failures.push(
              `${objective.lessonId}/${objective.stepId}/${viewportClass}: comparison title is empty for ${locale}`,
            );
          }
          for (const [rowIndex, row] of comparison.rows.entries()) {
            if (
              !row.property[locale].trim() ||
              !row.containerRestart[locale].trim() ||
              !row.podReplacement[locale].trim()
            ) {
              failures.push(
                `${objective.lessonId}/${objective.stepId}/${viewportClass}: comparison row ${String(rowIndex + 1)} is incomplete for ${locale}`,
              );
            }
          }
        }
      }
      if (compiledStep.view.comparison) {
        comparisonModels.set(
          `${objective.lessonId}:${objective.stepId}`,
          compiledStep.view.comparison,
        );
      }
    } else if (compiledStep.view.comparison || mobileStep.view.comparison) {
      failures.push(`${objective.id}: scene objective unexpectedly compiled as a comparison`);
    }
    if (objective.reducedMotion && !objective.route) {
      failures.push(`${objective.id}: reduced-motion capture requires a persistent route`);
    }
    if (objective.reducedMotion && expectsComparison) {
      failures.push(`${objective.id}: comparison objectives cannot use the route replay probe`);
    }
    if (objective.route) {
      if (!objective.expectedRouteId || !objective.expectedRouteSemantic) {
        failures.push(`${objective.id}: route objective lacks an expected route contract`);
        continue;
      }
      const route = compiledStep.view.activeRoutes.find(
        (candidate) => candidate.id === objective.expectedRouteId,
      );
      if (!route) {
        failures.push(`${objective.id}: route ${objective.expectedRouteId} is missing`);
        continue;
      }
      if (route.semantic !== objective.expectedRouteSemantic) {
        failures.push(
          `${objective.id}: route semantic=${route.semantic}; expected ${objective.expectedRouteSemantic}`,
        );
      }
      if (!route.persistAfterAnimation) failures.push(`${objective.id}: route is not persistent`);
      if (route.numbered !== true) failures.push(`${objective.id}: route must expose markers`);
      if (route.hops.length === 0) failures.push(`${objective.id}: route has no hops`);
    }
  }

  const captures = objectives.flatMap((objective) => {
    const step = stepIndices.get(`${objective.lessonId}:${objective.stepId}`);
    if (step === undefined) return [];
    const viewports = [
      { id: '1440x900', size: { width: 1440, height: 900 }, locale: objective.locales[0] },
      {
        id: `1280x${String(objective.mediumHeight)}`,
        size: { width: 1280, height: objective.mediumHeight },
        locale: objective.locales[1],
      },
      { id: '390x844', size: { width: 390, height: 844 }, locale: objective.locales[2] },
    ] as const;
    const expectedComparison = comparisonModels.get(`${objective.lessonId}:${objective.stepId}`);
    return viewports.map((viewport) => ({
      ...objective,
      step,
      viewportId: viewport.id,
      viewport: viewport.size,
      locale: viewport.locale,
      ...(expectedComparison ? { expectedComparison } : {}),
    }));
  });
  const reducedMotionCases = captures.filter((capture) => capture.reducedMotion).length;
  if (captures.length < MINIMUM_SETTLED_CASES) {
    failures.push(
      `settled matrix has ${String(captures.length)} cases; expected >=${String(MINIMUM_SETTLED_CASES)}`,
    );
  }
  if (reducedMotionCases < MINIMUM_REDUCED_MOTION_CASES) {
    failures.push(
      `reduced-motion matrix has ${String(reducedMotionCases)} cases; expected >=${String(MINIMUM_REDUCED_MOTION_CASES)}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`M8 curriculum capture preflight failed:\n${failures.join('\n')}`);
  }
  return captures;
}

async function getDiagnostics(page: Page): Promise<SceneDiagnostics> {
  const diagnostics = await page.evaluate(() =>
    (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');
  return diagnostics;
}

async function waitForSettledScene(page: Page, routeRequired: boolean): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(
    (requiresRoute) => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
        diagnostics.entityHandles > 0 &&
        diagnostics.safeRectWidth > 0 &&
        diagnostics.safeRectHeight > 0 &&
        (!requiresRoute || diagnostics.routeHandles > 0) &&
        diagnostics.flowTokens === 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.activeCameraTransitions === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    routeRequired,
    { timeout: 25_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForTimeout(180);
}

async function waitForComparison(page: Page, expectedRows: number): Promise<void> {
  const panel = page.getByTestId('comparison-panel');
  await panel.waitFor({ state: 'visible' });
  await page.waitForFunction(
    (rowCount) => {
      const comparison = document.querySelector<HTMLElement>('[data-testid="comparison-panel"]');
      if (!comparison) return false;
      const cards = [...comparison.querySelectorAll<HTMLElement>('.compare-card')];
      return (
        cards.length === 2 &&
        cards.every(
          (card) =>
            card.querySelectorAll('dl > div').length === rowCount &&
            [...card.querySelectorAll('dt, dd')].every((cell) => Boolean(cell.textContent?.trim())),
        )
      );
    },
    expectedRows,
    { timeout: 20_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForTimeout(180);
}

async function waitForCaptureReady(page: Page, capture: CaptureCase): Promise<void> {
  if (capture.presentation === 'comparison') {
    const expectedRows = capture.expectedComparison?.rows.length;
    if (!expectedRows) throw new Error(`${capture.id}: expected comparison model is unavailable`);
    await waitForComparison(page, expectedRows);
    return;
  }
  await waitForSettledScene(page, capture.route);
}

async function openCapture(page: Page, capture: CaptureCase): Promise<void> {
  await page.goto(`${baseUrl}/#/learn/${capture.lessonId}/${String(capture.step)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    (displayedStep) =>
      document.querySelector('.step-timeline [aria-current="step"] span')?.textContent?.trim() ===
      String(displayedStep),
    capture.step + 1,
    { timeout: 20_000 },
  );
  await page.locator('.lesson-language select').selectOption(capture.locale);
  await page.waitForFunction((locale) => document.documentElement.lang === locale, capture.locale, {
    timeout: 10_000,
  });
  const teachingToggle = page.locator('.teaching-sheet-toggle');
  if (
    capture.viewport.width <= MOBILE_BREAKPOINT &&
    (await teachingToggle.getAttribute('aria-expanded')) === 'false'
  ) {
    await teachingToggle.click();
  }
  await waitForCaptureReady(page, capture);
}

async function inspectSources(page: Page) {
  const button = page.locator('.teaching-panel-actions button').nth(1);
  const badgeLocator = button.locator('span');
  const badge = (await badgeLocator.count()) > 0 ? await badgeLocator.textContent() : null;
  const declaredCount = Number.parseInt(badge?.trim() ?? '0', 10);
  const disabled = await button.isDisabled();
  if (!disabled) {
    await button.click();
    await page.locator('#details-panel-sources').waitFor({ state: 'visible' });
  }
  const links = disabled
    ? []
    : await page.locator('#details-panel-sources a').evaluateAll((anchors) =>
        anchors.map((anchor) => ({
          title: anchor.querySelector('span')?.textContent?.trim() ?? '',
          authority: anchor.querySelector('small')?.textContent?.trim() ?? '',
          href: (anchor as HTMLAnchorElement).href,
          target: anchor.getAttribute('target'),
          rel: anchor.getAttribute('rel'),
        })),
      );
  const verificationText = disabled
    ? ''
    : ((await page.locator('#details-panel-sources p').textContent())?.trim() ?? '');
  if (!disabled) {
    await page.locator('.inspector-drawer .drawer-header button').click();
    await page.locator('.inspector-drawer').waitFor({ state: 'hidden' });
  }
  await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('#teaching-sheet-body');
    if (body) body.scrollTop = 0;
  });
  return { declaredCount, disabled, links, verificationText };
}

async function inspectTeaching(page: Page) {
  const readSection = async (testId: string) => {
    const section = page.getByTestId(testId);
    return {
      visible: await section.isVisible(),
      heading: (await section.locator('h2, h3').first().textContent())?.trim() ?? '',
      body: (await section.locator('p').first().textContent())?.trim() ?? '',
    };
  };
  const evidencePanel = page.getByTestId('evidence-panel');
  const evidenceRows = await evidencePanel.locator('.evidence-row').evaluateAll((rows) =>
    rows.map((row) => ({
      change: row.getAttribute('data-change'),
      kind: row.getAttribute('data-evidence-kind'),
      text: row.textContent?.trim() ?? '',
    })),
  );
  const emptyEvidence = evidencePanel.locator('.evidence-empty');
  return {
    heading: {
      visible: await page.getByTestId('teaching-step-heading').isVisible(),
      text: (await page.getByTestId('teaching-step-heading').textContent())?.trim() ?? '',
    },
    whatChanged: await readSection('teaching-what-changed'),
    whyItHappened: await readSection('teaching-why-it-happened'),
    takeaway: await readSection('teaching-takeaway'),
    evidence: {
      visible: await evidencePanel.isVisible(),
      text: (await evidencePanel.textContent())?.trim() ?? '',
      emptyText:
        (await emptyEvidence.count()) > 0
          ? ((await emptyEvidence.textContent())?.trim() ?? '')
          : '',
      rows: evidenceRows,
    },
    mobileSheetExpanded:
      (await page.getByTestId('teaching-sheet').getAttribute('class'))?.includes('is-expanded') ??
      false,
  };
}

async function inspectLabels(page: Page, diagnostics: SceneDiagnostics, locale: Locale) {
  const labels = await page
    .locator('.scene-viewport .scene-label:visible, .scene-viewport .scene-callout:visible')
    .evaluateAll((elements) =>
      elements.map((element, index) => {
        const html = element as HTMLElement;
        const rect = html.getBoundingClientRect();
        const source = html.classList.contains('scene-route-label')
          ? 'route'
          : html.classList.contains('scene-callout')
            ? 'callout'
            : html.classList.contains('scene-layout-label')
              ? 'layout'
              : html.dataset.entityId
                ? 'entity'
                : 'other';
        return {
          key:
            html.dataset.entityId ??
            html.dataset.routeLabelId ??
            html.dataset.layoutLabelId ??
            html.dataset.calloutId ??
            `visible-${String(index)}`,
          source,
          text: html.textContent?.trim() ?? '',
          lang: html.getAttribute('lang'),
          emphasis: html.dataset.emphasis ?? null,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      }),
    );
  const focusedEntityRecords = await page
    .locator('.scene-label[data-entity-id][data-emphasis="focused"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        entityId: (element as HTMLElement).dataset.entityId ?? '',
        hidden:
          (element as HTMLElement).hidden === true ||
          (element as HTMLElement).hidden === 'until-found' ||
          getComputedStyle(element).display === 'none',
      })),
    );
  const host = await page.getByTestId('scene-render-host').boundingBox();
  if (!host) throw new Error('Scene render host has no measurable bounds');
  const safeRect: Rectangle = {
    x: host.x + diagnostics.safeRectX,
    y: host.y + diagnostics.safeRectY,
    width: diagnostics.safeRectWidth,
    height: diagnostics.safeRectHeight,
  };
  const overlaps: Array<{ readonly left: string; readonly right: string }> = [];
  for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
      const left = labels[leftIndex];
      const right = labels[rightIndex];
      if (left && right && intersectionArea(left.rect, right.rect) > 0.25) {
        overlaps.push({ left: left.key, right: right.key });
      }
    }
  }
  return {
    records: labels,
    counts: {
      total: labels.length,
      entity: labels.filter((label) => label.source === 'entity').length,
      layout: labels.filter((label) => label.source === 'layout').length,
      route: labels.filter((label) => label.source === 'route').length,
      callout: labels.filter((label) => label.source === 'callout').length,
      other: labels.filter((label) => label.source === 'other').length,
    },
    focusedEntityRecords,
    visibleFocusedEntities: focusedEntityRecords.filter((record) => !record.hidden).length,
    overlaps,
    outsideHost: labels.filter((label) => !inside(label.rect, host)).map((label) => label.key),
    outsideSafeRect: labels
      .filter((label) => !inside(label.rect, safeRect))
      .map((label) => label.key),
    languageMismatches: labels
      .filter((label) => label.lang !== null && label.lang !== locale)
      .map((label) => ({ key: label.key, lang: label.lang })),
    host,
    safeRect,
  };
}

function densityBudget(
  capture: CaptureCase,
  diagnostics: SceneDiagnostics,
  labels: Awaited<ReturnType<typeof inspectLabels>>,
): DensityBudgetInspection {
  const mobile = capture.viewport.width <= MOBILE_BREAKPOINT;
  return {
    viewportClass: mobile ? 'mobile' : 'desktop',
    maximumEntityHandles: mobile ? 10 : 20,
    maximumEntityLabels: mobile ? 3 : 7,
    maximumRouteLabels: mobile ? 1 : 3,
    entityHandles: diagnostics.entityHandles,
    visibleEntityLabels: labels.counts.entity,
    visibleRouteLabels: labels.counts.route,
    focusedEntityRecords: labels.focusedEntityRecords,
    visibleFocusedEntities: labels.visibleFocusedEntities,
  };
}

async function inspectHorizontalOverflow(page: Page) {
  return await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentScrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    rootScrollWidth: document.getElementById('root')?.scrollWidth ?? 0,
    rootClientWidth: document.getElementById('root')?.clientWidth ?? 0,
  }));
}

async function inspectComparisonPanel(page: Page) {
  const panel = page.getByTestId('comparison-panel');
  const cards = await panel.locator('.compare-card').evaluateAll((elements) =>
    elements.map((element) => {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return {
        kind: html.classList.contains('restart-card')
          ? 'restart'
          : html.classList.contains('replacement-card')
            ? 'replacement'
            : 'unknown',
        visible:
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number.parseFloat(style.opacity) > 0 &&
          rect.width > 0 &&
          rect.height > 0,
        title: html.querySelector('h3')?.textContent?.trim() ?? '',
        rows: [...html.querySelectorAll<HTMLElement>('dl > div')].map((row) => {
          const rowStyle = getComputedStyle(row);
          const rowRect = row.getBoundingClientRect();
          return {
            rendered:
              rowStyle.display !== 'none' &&
              rowStyle.visibility !== 'hidden' &&
              Number.parseFloat(rowStyle.opacity) > 0 &&
              rowRect.width > 0 &&
              rowRect.height > 0,
            property: row.querySelector('dt')?.textContent?.trim() ?? '',
            value: row.querySelector('dd')?.textContent?.trim() ?? '',
          };
        }),
      };
    }),
  );
  const geometry = await page.evaluate(() => {
    const comparison = document.querySelector<HTMLElement>('[data-testid="comparison-panel"]');
    const stage = document.querySelector<HTMLElement>('.lesson-stage-frame');
    if (!comparison || !stage) return null;
    const panelRect = comparison.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      panel: {
        x: panelRect.x,
        y: panelRect.y,
        width: panelRect.width,
        height: panelRect.height,
      },
      stage: {
        x: stageRect.x,
        y: stageRect.y,
        width: stageRect.width,
        height: stageRect.height,
      },
      horizontalOverflow: comparison.scrollWidth - comparison.clientWidth,
      verticalOverflow: comparison.scrollHeight - comparison.clientHeight,
    };
  });
  const stageBadge = page.locator('.lesson-stage-frame > .view-badge');
  const historyBadge = panel.locator('.compare-heading > span');
  const heading = panel.locator('.compare-heading h2');
  return {
    visible: await panel.isVisible(),
    ariaLabelledBy: await panel.getAttribute('aria-labelledby'),
    sceneViewportCount: await page.getByTestId('scene-viewport').count(),
    stageBadge: {
      visible: await stageBadge.isVisible(),
      text: (await stageBadge.textContent())?.trim() ?? '',
    },
    historyBadge: {
      visible: await historyBadge.isVisible(),
      text: (await historyBadge.textContent())?.trim() ?? '',
    },
    heading: {
      visible: await heading.isVisible(),
      id: await heading.getAttribute('id'),
      text: (await heading.textContent())?.trim() ?? '',
    },
    cards,
    geometry,
  };
}

const isMobileCapture = (capture: CaptureCase): boolean =>
  capture.viewport.width <= MOBILE_BREAKPOINT;

function expectedMinimumRelations(capture: CaptureCase): number {
  return isMobileCapture(capture)
    ? (capture.mobileMinimumRelations ?? capture.desktopMinimumRelations)
    : capture.desktopMinimumRelations;
}

function expectedHierarchy(capture: CaptureCase): HierarchyMinimums | undefined {
  return isMobileCapture(capture)
    ? (capture.mobileHierarchy ?? capture.desktopHierarchy)
    : capture.desktopHierarchy;
}

function gateHierarchy(
  diagnostics: SceneDiagnostics,
  minimums: HierarchyMinimums | undefined,
): string[] {
  const failures: string[] = [];
  const zeroFields = [
    'podPairOverlaps',
    'pendingPodsInsideNodes',
    'containersOutsidePods',
    ...(diagnostics.nodeHandles > 0
      ? ([
          'scheduledPodsOutsideBays',
          'duplicateBayAssignments',
          'podSystemModuleOverlaps',
          'orphanKubelets',
          'orphanContainerRuntimes',
        ] as const)
      : []),
  ] as const;
  for (const field of zeroFields) {
    if (diagnostics[field] !== 0)
      failures.push(`${field}=${String(diagnostics[field])}; expected 0`);
  }
  const minimumChecks = [
    ['nodeHandles', diagnostics.nodeHandles, minimums?.nodes],
    ['podHandles', diagnostics.podHandles, minimums?.pods],
    ['containedContainers', diagnostics.containedContainers, minimums?.containedContainers],
    ['scheduledPods', diagnostics.scheduledPods, minimums?.scheduledPods],
    ['pendingPods', diagnostics.pendingPods, minimums?.pendingPods],
  ] as const;
  for (const [name, actual, expected] of minimumChecks) {
    if (expected !== undefined && actual < expected) {
      failures.push(`${name}=${String(actual)}; expected >=${String(expected)}`);
    }
  }
  return failures;
}

function gateRoute(diagnostics: SceneDiagnostics): string[] {
  const failures: string[] = [];
  if (diagnostics.routeHandles < 1) failures.push('routeHandles must be >0');
  if (diagnostics.arrowheads < 1) failures.push('persistent route has no arrowheads');
  if (diagnostics.routeMarkers < 1) failures.push('persistent route has no numbered markers');
  if (diagnostics.wideLineGeometries !== diagnostics.routeHandles) {
    failures.push(
      `wideLineGeometries=${String(diagnostics.wideLineGeometries)}; expected routeHandles=${String(diagnostics.routeHandles)}`,
    );
  }
  if (diagnostics.wideLineMaterials !== diagnostics.routeHandles) {
    failures.push(
      `wideLineMaterials=${String(diagnostics.wideLineMaterials)}; expected routeHandles=${String(diagnostics.routeHandles)}`,
    );
  }
  const zeroFields = [
    'routesOutsideSafeRect',
    'arrowheadsOutsideSafeRect',
    'routeMarkersOutsideSafeRect',
    'routeObstacleIntersections',
    'routeEndpointDriftCount',
    'activeRouteWidthsBelowMinimum',
    'visibleRoutesWithoutArrowheads',
    'flowTokensOffRoute',
    'routeReplanFailures',
  ] as const;
  for (const field of zeroFields) {
    if (diagnostics[field] !== 0)
      failures.push(`${field}=${String(diagnostics[field])}; expected 0`);
  }
  if (diagnostics.maximumFlowTokenRouteDistance > MAXIMUM_TOKEN_ROUTE_DISTANCE) {
    failures.push(
      `maximumFlowTokenRouteDistance=${String(diagnostics.maximumFlowTokenRouteDistance)}; expected <=${String(MAXIMUM_TOKEN_ROUTE_DISTANCE)}`,
    );
  }
  return failures;
}

function gateTeachingSourcesAndOverflow(
  capture: CaptureCase,
  inspection: {
    readonly documentLanguage: string | null;
    readonly teaching: Awaited<ReturnType<typeof inspectTeaching>>;
    readonly sources: Awaited<ReturnType<typeof inspectSources>>;
    readonly overflow: Awaited<ReturnType<typeof inspectHorizontalOverflow>>;
  },
): string[] {
  const failures: string[] = [];
  const { teaching, sources, overflow } = inspection;
  if (inspection.documentLanguage !== capture.locale) {
    failures.push(
      `document lang=${String(inspection.documentLanguage)}; expected ${capture.locale}`,
    );
  }
  if (!teaching.heading.text) {
    failures.push('teaching step heading text is missing');
  }
  if (!isMobileCapture(capture) && !teaching.heading.visible) {
    failures.push('desktop teaching step heading is not visible');
  }
  for (const [name, section] of [
    ['What changed', teaching.whatChanged],
    ['Why', teaching.whyItHappened],
    ['Takeaway', teaching.takeaway],
  ] as const) {
    if (!section.visible) failures.push(`${name} section is not visible`);
    if (!section.heading) failures.push(`${name} heading is empty`);
    if (!section.body) failures.push(`${name} body is empty`);
  }
  if (!teaching.evidence.visible) failures.push('Evidence panel is not visible');
  if (teaching.evidence.rows.length < 1 || teaching.evidence.emptyText) {
    failures.push('Representative step must expose at least one factual Evidence row');
  }
  if (isMobileCapture(capture) && !teaching.mobileSheetExpanded) {
    failures.push('Mobile teaching sheet is not expanded');
  }
  if (sources.disabled || sources.declaredCount < 1 || sources.links.length < 1) {
    failures.push('Representative step has no inspectable official source');
  }
  if (sources.declaredCount !== sources.links.length) {
    failures.push(
      `source badge=${String(sources.declaredCount)}; drawer links=${String(sources.links.length)}`,
    );
  }
  for (const source of sources.links) {
    if (!source.title || !source.authority)
      failures.push(`source metadata is incomplete: ${source.href}`);
    if (!source.href.startsWith('https://kubernetes.io/')) {
      failures.push(`source is not official Kubernetes documentation: ${source.href}`);
    }
    if (source.target !== '_blank' || !source.rel?.includes('noopener')) {
      failures.push(`source link lacks safe external-link attributes: ${source.href}`);
    }
  }
  if (!/\d{4}-\d{2}-\d{2}/.test(sources.verificationText)) {
    failures.push('Sources drawer does not expose a verification date');
  }
  if (overflow.documentScrollWidth - overflow.viewportWidth > 1) {
    failures.push(
      `document horizontal overflow=${String(overflow.documentScrollWidth - overflow.viewportWidth)}px`,
    );
  }
  if (overflow.rootScrollWidth - overflow.rootClientWidth > 1) {
    failures.push(
      `root horizontal overflow=${String(overflow.rootScrollWidth - overflow.rootClientWidth)}px`,
    );
  }
  return failures;
}

function gateInspection(
  capture: CaptureCase,
  inspection: {
    readonly documentLanguage: string | null;
    readonly view: ViewMode;
    readonly diagnostics: SceneDiagnostics;
    readonly density: DensityBudgetInspection;
    readonly labels: Awaited<ReturnType<typeof inspectLabels>>;
    readonly teaching: Awaited<ReturnType<typeof inspectTeaching>>;
    readonly sources: Awaited<ReturnType<typeof inspectSources>>;
    readonly overflow: Awaited<ReturnType<typeof inspectHorizontalOverflow>>;
    readonly accessibleSummary: string;
  },
): string[] {
  const failures = gateTeachingSourcesAndOverflow(capture, inspection);
  const { diagnostics, labels, density } = inspection;
  if (inspection.view !== capture.expectedView) {
    failures.push(`view=${String(inspection.view)}; expected ${capture.expectedView}`);
  }
  if (diagnostics.cameraMode !== 'orthographic') {
    failures.push(`lesson camera=${diagnostics.cameraMode}; expected orthographic`);
  }
  if (diagnostics.entityHandles < 1) failures.push('scene has no rendered entities');
  if (diagnostics.entityHandles > density.maximumEntityHandles) {
    failures.push(
      `entityHandles=${String(diagnostics.entityHandles)} exceeds ${density.viewportClass} ceiling ${String(density.maximumEntityHandles)}`,
    );
  }
  if (labels.counts.entity > density.maximumEntityLabels) {
    failures.push(
      `visible entity labels=${String(labels.counts.entity)} exceeds ${String(density.maximumEntityLabels)}`,
    );
  }
  if (labels.counts.route > density.maximumRouteLabels) {
    failures.push(
      `visible route labels=${String(labels.counts.route)} exceeds ${String(density.maximumRouteLabels)}`,
    );
  }
  if (density.focusedEntityRecords.length !== 1 || density.visibleFocusedEntities !== 1) {
    failures.push(
      `focus records=${String(density.focusedEntityRecords.length)}, visible=${String(density.visibleFocusedEntities)}; expected exactly one visible focus`,
    );
  }
  const minimumRelations = expectedMinimumRelations(capture);
  if (diagnostics.relationHandles < minimumRelations) {
    failures.push(
      `relationHandles=${String(diagnostics.relationHandles)}; expected >=${String(minimumRelations)} for ${density.viewportClass}`,
    );
  }
  if (
    capture.minimumFoundationMeshes !== undefined &&
    diagnostics.foundationMeshes < capture.minimumFoundationMeshes
  ) {
    failures.push(
      `foundationMeshes=${String(diagnostics.foundationMeshes)}; expected >=${String(capture.minimumFoundationMeshes)}`,
    );
  }
  if (labels.counts.other !== 0)
    failures.push(`unclassified labels=${String(labels.counts.other)}`);
  if (labels.overlaps.length > 0) {
    failures.push(
      `label overlaps: ${labels.overlaps.map((pair) => `${pair.left}/${pair.right}`).join(', ')}`,
    );
  }
  if (labels.outsideHost.length > 0) {
    failures.push(`labels outside scene host: ${labels.outsideHost.join(', ')}`);
  }
  if (labels.outsideSafeRect.length > 0) {
    failures.push(`labels outside safe rect: ${labels.outsideSafeRect.join(', ')}`);
  }
  if (labels.languageMismatches.length > 0) {
    failures.push(
      `label language mismatch: ${labels.languageMismatches
        .map((entry) => `${entry.key}=${String(entry.lang)}`)
        .join(', ')}`,
    );
  }
  if (diagnostics.focusedEntitiesOutsideSafeRect !== 0) {
    failures.push(
      `focusedEntitiesOutsideSafeRect=${String(diagnostics.focusedEntitiesOutsideSafeRect)}; expected 0`,
    );
  }
  if (diagnostics.sceneBoundsOutsideContentRect !== 0) {
    failures.push(
      `sceneBoundsOutsideContentRect=${String(diagnostics.sceneBoundsOutsideContentRect)}; expected 0`,
    );
  }
  if (
    diagnostics.activeAnimations !== 0 ||
    diagnostics.activeCameraTransitions !== 0 ||
    diagnostics.retainedExitHandles !== 0 ||
    diagnostics.flowTokens !== 0
  ) {
    failures.push('settled capture retains animation, camera transition, exit handle, or token');
  }
  failures.push(...gateHierarchy(diagnostics, expectedHierarchy(capture)));
  if (capture.route) {
    failures.push(...gateRoute(diagnostics));
    if (labels.counts.route < 1) failures.push('persistent route has no visible route label');
    if (!inspection.accessibleSummary.includes(' route:')) {
      failures.push('accessible scene summary does not describe route hops');
    }
  }
  return failures;
}

function gateComparisonInspection(
  capture: CaptureCase,
  inspection: {
    readonly documentLanguage: string | null;
    readonly comparison: Awaited<ReturnType<typeof inspectComparisonPanel>>;
    readonly teaching: Awaited<ReturnType<typeof inspectTeaching>>;
    readonly sources: Awaited<ReturnType<typeof inspectSources>>;
    readonly overflow: Awaited<ReturnType<typeof inspectHorizontalOverflow>>;
  },
): string[] {
  const failures = gateTeachingSourcesAndOverflow(capture, inspection);
  const { comparison } = inspection;
  const expected = capture.expectedComparison;
  if (!expected) {
    failures.push('compiled comparison model is unavailable');
    return failures;
  }
  if (!comparison.visible) failures.push('comparison panel is not visible');
  if (comparison.sceneViewportCount !== 0) {
    failures.push(
      `comparison mounted ${String(comparison.sceneViewportCount)} scene viewport(s); expected 0`,
    );
  }
  const view = comparison.stageBadge.text.trim().toLowerCase().replaceAll(/\s+/g, '-') as ViewMode;
  if (view !== capture.expectedView) {
    failures.push(`comparison view badge=${String(view)}; expected ${capture.expectedView}`);
  }
  if (!comparison.historyBadge.visible || comparison.historyBadge.text !== 'WORLD HISTORY') {
    failures.push(
      `comparison badge=${JSON.stringify(comparison.historyBadge.text)}; expected visible WORLD HISTORY`,
    );
  }
  if (!comparison.heading.visible || comparison.heading.text !== expected.title[capture.locale]) {
    failures.push(
      `comparison heading=${JSON.stringify(comparison.heading.text)}; expected ${JSON.stringify(expected.title[capture.locale])}`,
    );
  }
  if (
    !comparison.ariaLabelledBy ||
    !comparison.heading.id ||
    comparison.ariaLabelledBy !== comparison.heading.id
  ) {
    failures.push('comparison panel is not labelled by its visible heading');
  }
  if (!comparison.geometry) {
    failures.push('comparison geometry is unavailable');
  } else {
    if (!inside(comparison.geometry.panel, comparison.geometry.stage)) {
      failures.push('comparison panel leaves the lesson stage');
    }
    if (comparison.geometry.horizontalOverflow > 1) {
      failures.push(
        `comparison horizontal overflow=${String(comparison.geometry.horizontalOverflow)}px`,
      );
    }
  }
  if (comparison.cards.length !== 2) {
    failures.push(`comparison cards=${String(comparison.cards.length)}; expected 2`);
    return failures;
  }
  const expectedCards = [
    {
      kind: 'restart',
      rows: expected.rows.map((row) => ({
        property: row.property[capture.locale],
        value: row.containerRestart[capture.locale],
      })),
    },
    {
      kind: 'replacement',
      rows: expected.rows.map((row) => ({
        property: row.property[capture.locale],
        value: row.podReplacement[capture.locale],
      })),
    },
  ] as const;
  for (const [cardIndex, card] of comparison.cards.entries()) {
    const expectedCard = expectedCards[cardIndex];
    if (!expectedCard) continue;
    if (!card.visible) failures.push(`comparison ${expectedCard.kind} card is not visible`);
    if (card.kind !== expectedCard.kind) {
      failures.push(
        `comparison card ${String(cardIndex + 1)} kind=${card.kind}; expected ${expectedCard.kind}`,
      );
    }
    if (!card.title) failures.push(`comparison ${expectedCard.kind} card title is empty`);
    if (card.rows.length !== expectedCard.rows.length) {
      failures.push(
        `comparison ${expectedCard.kind} rows=${String(card.rows.length)}; expected ${String(expectedCard.rows.length)}`,
      );
    }
    for (const [rowIndex, expectedRow] of expectedCard.rows.entries()) {
      const row = card.rows[rowIndex];
      if (!row) continue;
      if (!row.rendered) {
        failures.push(
          `comparison ${expectedCard.kind} row ${String(rowIndex + 1)} is not rendered`,
        );
      }
      if (row.property !== expectedRow.property || row.value !== expectedRow.value) {
        failures.push(
          `comparison ${expectedCard.kind} row ${String(rowIndex + 1)} does not match the compiled snapshot`,
        );
      }
    }
  }
  if (comparison.cards[0]?.title && comparison.cards[0].title === comparison.cards[1]?.title) {
    failures.push('comparison card titles do not distinguish restart from replacement');
  }
  const restartValues = comparison.cards[0]?.rows.map((row) => row.value) ?? [];
  const replacementValues = comparison.cards[1]?.rows.map((row) => row.value) ?? [];
  if (
    restartValues.length === 0 ||
    restartValues.every((value, index) => value === replacementValues[index])
  ) {
    failures.push('comparison rows do not expose any restart/replacement difference');
  }
  return failures;
}

async function inspectCapture(page: Page, capture: CaptureCase, phase: Phase) {
  const sources = await inspectSources(page);
  await waitForCaptureReady(page, capture);
  const teaching = await inspectTeaching(page);
  const overflow = await inspectHorizontalOverflow(page);
  const screenshot = captureScreenshotName(capture, phase);
  const documentLanguage = await page.locator('html').getAttribute('lang');
  if (capture.presentation === 'comparison') {
    const inspection = {
      phase,
      screenshot,
      documentLanguage,
      comparison: await inspectComparisonPanel(page),
      teaching,
      sources,
      overflow,
    };
    const failures = gateComparisonInspection(capture, inspection);
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });
    return { ...inspection, failures };
  }
  const diagnostics = await getDiagnostics(page);
  const labels = await inspectLabels(page, diagnostics, capture.locale);
  const viewText = (await page.locator('.lesson-stage-frame > .view-badge').textContent()) ?? '';
  const view = viewText.trim().toLowerCase().replaceAll(/\s+/g, '-') as ViewMode;
  const inspection = {
    phase,
    screenshot,
    documentLanguage,
    view,
    diagnostics,
    density: densityBudget(capture, diagnostics, labels),
    labels,
    teaching,
    sources,
    overflow,
    accessibleSummary:
      (await page.locator('#scene-accessible-summary').textContent())?.trim() ?? '',
  };
  const failures = gateInspection(capture, inspection);
  await page.screenshot({
    path: path.join(outputDirectory, screenshot),
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    scale: 'css',
  });
  return { ...inspection, failures };
}

function captureScreenshotName(capture: CaptureCase, phase: Phase): string {
  return `m8-${capture.id}-${capture.viewportId}-${capture.locale}-${phase}.png`;
}

async function probeReducedMotion(page: Page): Promise<ReducedMotionProbe> {
  return await page.evaluate(async () => {
    const probe = {
      samples: 0,
      maxFlowTokens: 0,
      minRouteHandles: Number.POSITIVE_INFINITY,
      minArrowheads: Number.POSITIVE_INFINITY,
      minRouteMarkers: Number.POSITIVE_INFINITY,
      maxObstacleIntersections: 0,
      maxEndpointDrift: 0,
      maxReplanFailures: 0,
      maxOffRouteTokens: 0,
      maximumTokenRouteDistance: 0,
    };
    const deadline = performance.now() + 2_200;
    while (performance.now() < deadline) {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      if (diagnostics) {
        probe.samples += 1;
        probe.maxFlowTokens = Math.max(probe.maxFlowTokens, diagnostics.flowTokens);
        probe.minRouteHandles = Math.min(probe.minRouteHandles, diagnostics.routeHandles);
        probe.minArrowheads = Math.min(probe.minArrowheads, diagnostics.arrowheads);
        probe.minRouteMarkers = Math.min(probe.minRouteMarkers, diagnostics.routeMarkers);
        probe.maxObstacleIntersections = Math.max(
          probe.maxObstacleIntersections,
          diagnostics.routeObstacleIntersections,
        );
        probe.maxEndpointDrift = Math.max(
          probe.maxEndpointDrift,
          diagnostics.routeEndpointDriftCount,
        );
        probe.maxReplanFailures = Math.max(
          probe.maxReplanFailures,
          diagnostics.routeReplanFailures,
        );
        probe.maxOffRouteTokens = Math.max(probe.maxOffRouteTokens, diagnostics.flowTokensOffRoute);
        probe.maximumTokenRouteDistance = Math.max(
          probe.maximumTokenRouteDistance,
          diagnostics.maximumFlowTokenRouteDistance,
        );
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return probe;
  });
}

function gateReducedMotion(probe: ReducedMotionProbe): string[] {
  const failures: string[] = [];
  if (probe.samples < 2)
    failures.push(`reduced-motion samples=${String(probe.samples)}; expected >=2`);
  if (probe.maxFlowTokens !== 0) {
    failures.push(`reduced motion leased ${String(probe.maxFlowTokens)} flow token(s)`);
  }
  if (probe.minRouteHandles < 1) failures.push('route disappeared during reduced-motion replay');
  if (probe.minArrowheads < 1) failures.push('arrowheads disappeared during reduced-motion replay');
  if (probe.minRouteMarkers < 1)
    failures.push('route markers disappeared during reduced-motion replay');
  if (probe.maxObstacleIntersections !== 0)
    failures.push('route intersected an obstacle in reduced motion');
  if (probe.maxEndpointDrift !== 0) failures.push('route endpoint drifted in reduced motion');
  if (probe.maxReplanFailures !== 0) failures.push('route replan failed in reduced motion');
  if (probe.maxOffRouteTokens !== 0) failures.push('off-route token appeared in reduced motion');
  if (probe.maximumTokenRouteDistance > MAXIMUM_TOKEN_ROUTE_DISTANCE) {
    failures.push(
      `reduced-motion token distance=${String(probe.maximumTokenRouteDistance)}; expected <=${String(MAXIMUM_TOKEN_ROUTE_DISTANCE)}`,
    );
  }
  return failures;
}

async function captureSettled(context: BrowserContext, capture: CaptureCase) {
  const page = await context.newPage();
  try {
    await openCapture(page, capture);
    return await inspectCapture(page, capture, 'settled');
  } finally {
    await page.close();
  }
}

async function captureReduced(context: BrowserContext, capture: CaptureCase) {
  const page = await context.newPage();
  try {
    await openCapture(page, capture);
    await page.locator('.lesson-header-actions button').first().click();
    const probe = await probeReducedMotion(page);
    await waitForSettledScene(page, true);
    const inspection = await inspectCapture(page, capture, 'reduced-motion');
    return {
      ...inspection,
      reducedMotionProbe: probe,
      failures: [...inspection.failures, ...gateReducedMotion(probe)],
    };
  } finally {
    await page.close();
  }
}

const captures = await resolveCaptures();
await mkdir(outputDirectory, { recursive: true });
const staleArtifactNames = (await readdir(outputDirectory)).filter(
  (name) => name === 'm8-curriculum-visual-manifest.json' || /^m8-.*\.png$/u.test(name),
);
await Promise.all(
  staleArtifactNames.map((name) => rm(path.join(outputDirectory, name), { force: true })),
);

const browser = await chromium.launch({ headless: true });
const results: Array<{
  readonly capture: CaptureCase;
  readonly status: 'pass' | 'fail';
  readonly failures: readonly string[];
  readonly phases: readonly Awaited<ReturnType<typeof inspectCapture>>[];
}> = [];
const gateFailures: string[] = [];

try {
  for (const capture of captures) {
    const browserLocale =
      capture.locale === 'ja' ? 'ja-JP' : capture.locale === 'zh-CN' ? 'zh-CN' : 'en-US';
    const normalContext = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale: browserLocale,
      reducedMotion: 'no-preference',
      deviceScaleFactor: 1,
    });
    const reducedContext = capture.reducedMotion
      ? await browser.newContext({
          viewport: capture.viewport,
          colorScheme: 'dark',
          locale: browserLocale,
          reducedMotion: 'reduce',
          deviceScaleFactor: 1,
        })
      : undefined;
    let phases: readonly Awaited<ReturnType<typeof inspectCapture>>[] = [];
    let failures: string[] = [];
    try {
      const settled = await captureSettled(normalContext, capture);
      const reduced = reducedContext ? await captureReduced(reducedContext, capture) : undefined;
      phases = reduced ? [settled, reduced] : [settled];
      failures = phases.flatMap((phase) =>
        phase.failures.map((failure) => `${phase.phase}: ${failure}`),
      );
    } catch (error: unknown) {
      failures = [errorText(error)];
    } finally {
      await normalContext.close();
      await reducedContext?.close();
    }
    if (failures.length > 0)
      gateFailures.push(`${capture.id}/${capture.viewportId}: ${failures.join('; ')}`);
    results.push({
      capture,
      status: failures.length === 0 ? 'pass' : 'fail',
      failures,
      phases,
    });
  }
} finally {
  await browser.close();
}

const reducedCaptureCount = captures.filter((capture) => capture.reducedMotion).length;
const expectedScreenshotNames = new Set(
  captures.flatMap((capture) =>
    (capture.reducedMotion ? (['settled', 'reduced-motion'] as const) : (['settled'] as const)).map(
      (phase) => captureScreenshotName(capture, phase),
    ),
  ),
);
const actualScreenshotNames = (await readdir(outputDirectory))
  .filter((name) => /^m8-.*\.png$/u.test(name))
  .sort();
const missingScreenshotNames = [...expectedScreenshotNames]
  .filter((name) => !actualScreenshotNames.includes(name))
  .sort();
const extraScreenshotNames = actualScreenshotNames.filter(
  (name) => !expectedScreenshotNames.has(name),
);
if (missingScreenshotNames.length > 0) {
  gateFailures.push(`missing M8 screenshots: ${missingScreenshotNames.join(', ')}`);
}
if (extraScreenshotNames.length > 0) {
  gateFailures.push(`extra M8 screenshots: ${extraScreenshotNames.join(', ')}`);
}
const manifest = {
  generatedAt: new Date().toISOString(),
  milestone: 8,
  baseUrl,
  status: gateFailures.length === 0 ? 'pass' : 'fail',
  coverage: {
    lessons: lessonIds,
    newlyPublishedLessons: newlyPublishedLessonIds,
    objectives: objectives.map((objective) => ({
      id: objective.id,
      lessonId: objective.lessonId,
      stepId: objective.stepId,
      expectedView: objective.expectedView,
      route: objective.route,
      reducedMotion: objective.reducedMotion,
      expectedRouteId: objective.expectedRouteId ?? null,
      expectedRouteSemantic: objective.expectedRouteSemantic ?? null,
    })),
    viewports: ['1440x900', '1280x720', '1280x800', '390x844'],
    locales: ['en', 'ja', 'zh-CN'],
    settledCases: captures.length,
    reducedMotionCases: reducedCaptureCount,
    screenshots: captures.length + reducedCaptureCount,
    artifacts: {
      pngs: actualScreenshotNames.length,
      expected: expectedScreenshotNames.size,
      missing: missingScreenshotNames,
      extra: extraScreenshotNames,
    },
    minimums: {
      settledCases: MINIMUM_SETTLED_CASES,
      reducedMotionCases: MINIMUM_REDUCED_MOTION_CASES,
    },
    matrix:
      'Every objective is captured at 1440x900, one 1280x720/800 risk height, and 390x844. Locale rotation supplies EN, JA, and zh-CN for each objective.',
  },
  gates: {
    allTwelveLessonsSchemaV2AndAvailable: true,
    everyLessonRepresented: true,
    allCompiledStepsHaveExactlyOneFocus: true,
    teachingFieldsAndEvidenceRequired: true,
    expectedSceneGrammarBadge: true,
    observableGrammarDensityBudget: true,
    labelOverlapAndSafeRectViolations: 0,
    hierarchyContainmentViolations: 0,
    persistentWideRouteArrowAndMarkerRequired: true,
    endpointSlicePacketHops: 0,
    staticRouteSafetyViolations: 0,
    reducedMotionFlowTokens: 0,
    maximumFlowTokenRouteDistance: MAXIMUM_TOKEN_ROUTE_DISTANCE,
  },
  failures: gateFailures,
  captures: results,
};

const manifestPath = path.join(outputDirectory, 'm8-curriculum-visual-manifest.json');
const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
await writeFile(
  manifestPath,
  await format(JSON.stringify(manifest), { ...prettierConfig, filepath: manifestPath }),
  'utf8',
);

if (gateFailures.length > 0) {
  throw new Error(
    `M8 curriculum visual gate failed for ${String(gateFailures.length)} capture(s). See ${manifestPath}.\n${gateFailures.join('\n')}`,
  );
}

console.log(
  `Captured and checked ${String(captures.length)} M8 settled cases plus ${String(reducedCaptureCount)} reduced-motion route cases in ${outputDirectory}.`,
);
