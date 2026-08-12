/// <reference lib="dom" />

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page, type ViewportSize } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m7');
const coursePath = path.resolve('content/courses/kubernetes-foundations/course.yaml');
const lessonDirectory = path.resolve('content/courses/kubernetes-foundations/lessons');
const MOBILE_BREAKPOINT = 720;
const MAXIMUM_TOKEN_ROUTE_DISTANCE = 0.02;
const GEOMETRY_TOLERANCE_PX = 0.75;

type Locale = 'en' | 'ja' | 'zh-CN';
type LessonId =
  | 'cluster-overview'
  | 'pod-and-placement'
  | 'manifest-to-running-pod'
  | 'service-routes-to-pods'
  | 'container-restart-vs-pod-replacement';
type ViewMode = 'overview' | 'logical' | 'placement' | 'control-flow' | 'traffic' | 'storage';
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
  readonly minimumRelations: number;
  readonly minimumFocusedEntities: number;
  readonly minimumFoundationMeshes?: number;
  readonly hierarchy?: HierarchyMinimums;
}

interface CaptureCase extends ObjectiveDefinition {
  readonly step: number;
  readonly viewportId: string;
  readonly viewport: ViewportSize;
  readonly locale: Locale;
}

interface DensityBudgetInspection {
  readonly viewportClass: 'desktop' | 'mobile';
  readonly maximumEntityHandles: number;
  readonly maximumEntityLabels: number;
  readonly maximumRouteLabels: number;
  readonly maximumFocusedEntities: number;
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

const lessonIds: readonly LessonId[] = [
  'cluster-overview',
  'pod-and-placement',
  'manifest-to-running-pod',
  'service-routes-to-pods',
  'container-restart-vs-pod-replacement',
];

const objectives = [
  {
    id: 'cluster-foundation-summary',
    lessonId: 'cluster-overview',
    stepId: 'cluster-summary',
    expectedView: 'overview',
    locales: ['en', 'ja', 'zh-CN'],
    mediumHeight: 720,
    route: false,
    minimumRelations: 0,
    minimumFocusedEntities: 1,
    minimumFoundationMeshes: 1,
    hierarchy: { nodes: 1 },
  },
  {
    id: 'namespace-logical-scope',
    lessonId: 'pod-and-placement',
    stepId: 'logical-ownership',
    expectedView: 'logical',
    locales: ['ja', 'zh-CN', 'en'],
    mediumHeight: 800,
    route: false,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
  },
  {
    id: 'pod-physical-placement',
    lessonId: 'pod-and-placement',
    stepId: 'node-runtime-chassis',
    expectedView: 'placement',
    locales: ['zh-CN', 'en', 'ja'],
    mediumHeight: 720,
    route: false,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
    hierarchy: { nodes: 1, pods: 1, scheduledPods: 1 },
  },
  {
    id: 'manifest-enters-api',
    lessonId: 'manifest-to-running-pod',
    stepId: 'submit-deployment-manifest',
    expectedView: 'control-flow',
    locales: ['en', 'zh-CN', 'ja'],
    mediumHeight: 800,
    route: true,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
  },
  {
    id: 'scheduler-selects-node',
    lessonId: 'manifest-to-running-pod',
    stepId: 'scheduler-records-worker-c',
    expectedView: 'control-flow',
    locales: ['ja', 'en', 'zh-CN'],
    mediumHeight: 720,
    route: true,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
    hierarchy: { nodes: 1, pods: 1 },
  },
  {
    id: 'manifest-converges-running',
    lessonId: 'manifest-to-running-pod',
    stepId: 'pod-becomes-ready',
    expectedView: 'placement',
    locales: ['zh-CN', 'ja', 'en'],
    mediumHeight: 800,
    route: false,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
    hierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
  {
    id: 'endpoint-slice-evidence',
    lessonId: 'service-routes-to-pods',
    stepId: 'endpoint-slice-backends',
    expectedView: 'traffic',
    locales: ['en', 'ja', 'zh-CN'],
    mediumHeight: 720,
    route: false,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
  },
  {
    id: 'service-selects-ready-endpoint',
    lessonId: 'service-routes-to-pods',
    stepId: 'request-ready-backend',
    expectedView: 'traffic',
    locales: ['ja', 'zh-CN', 'en'],
    mediumHeight: 800,
    route: true,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
  },
  {
    id: 'container-restarts-in-place',
    lessonId: 'container-restart-vs-pod-replacement',
    stepId: 'container-restarted',
    expectedView: 'control-flow',
    locales: ['zh-CN', 'en', 'ja'],
    mediumHeight: 720,
    route: true,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
    hierarchy: { nodes: 1, pods: 1, containedContainers: 1, scheduledPods: 1 },
  },
  {
    id: 'replacement-pod-is-scheduled',
    lessonId: 'container-restart-vs-pod-replacement',
    stepId: 'scheduler-binds-worker-c',
    expectedView: 'control-flow',
    locales: ['en', 'zh-CN', 'ja'],
    mediumHeight: 800,
    route: true,
    minimumRelations: 1,
    minimumFocusedEntities: 1,
    hierarchy: { nodes: 1, pods: 1, scheduledPods: 1 },
  },
] as const satisfies readonly ObjectiveDefinition[];

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

interface RawCourse {
  readonly lessons?: readonly { readonly id?: string; readonly status?: string }[];
}

interface RawLesson {
  readonly schemaVersion?: number;
  readonly id?: string;
  readonly steps?: readonly { readonly id?: string }[];
}

async function resolveCaptures(): Promise<readonly CaptureCase[]> {
  const course = parse(await readFile(coursePath, 'utf8')) as RawCourse;
  const catalogStatus = new Map(
    (course.lessons ?? []).flatMap((entry) =>
      entry.id && entry.status ? [[entry.id, entry.status] as const] : [],
    ),
  );
  const stepIndices = new Map<string, number>();
  const migrationFailures: string[] = [];

  for (const lessonId of lessonIds) {
    const lessonPath = path.join(lessonDirectory, `${lessonId}.yaml`);
    const lesson = parse(await readFile(lessonPath, 'utf8')) as RawLesson;
    if (lesson.schemaVersion !== 2) {
      migrationFailures.push(
        `${lessonId}: schemaVersion=${String(lesson.schemaVersion)}; expected 2`,
      );
    }
    if (lesson.id !== lessonId) {
      migrationFailures.push(`${lessonId}: lesson id=${String(lesson.id)} does not match filename`);
    }
    if (catalogStatus.get(lessonId) !== 'available') {
      migrationFailures.push(
        `${lessonId}: course status=${String(catalogStatus.get(lessonId))}; expected available`,
      );
    }
    for (const [index, step] of (lesson.steps ?? []).entries()) {
      if (step.id) stepIndices.set(`${lessonId}:${step.id}`, index);
    }
  }

  for (const objective of objectives) {
    if (!stepIndices.has(`${objective.lessonId}:${objective.stepId}`)) {
      migrationFailures.push(
        `${objective.lessonId}: missing representative step id "${objective.stepId}"`,
      );
    }
  }

  if (migrationFailures.length > 0) {
    throw new Error(
      `M7 capture is intentionally blocked until all five migrations land:\n${migrationFailures.join('\n')}`,
    );
  }

  return objectives.flatMap((objective) => {
    const step = stepIndices.get(`${objective.lessonId}:${objective.stepId}`);
    if (step === undefined)
      throw new Error(`Unresolved step ${objective.lessonId}:${objective.stepId}`);
    const viewportDefinitions = [
      { id: '1440x900', size: { width: 1440, height: 900 }, locale: objective.locales[0] },
      {
        id: `1280x${String(objective.mediumHeight)}`,
        size: { width: 1280, height: objective.mediumHeight },
        locale: objective.locales[1],
      },
      { id: '390x844', size: { width: 390, height: 844 }, locale: objective.locales[2] },
    ] as const;
    return viewportDefinitions.map((viewport) => ({
      ...objective,
      step,
      viewportId: viewport.id,
      viewport: viewport.size,
      locale: viewport.locale,
    }));
  });
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
  await waitForSettledScene(page, capture.route);
}

async function inspectSources(page: Page) {
  const button = page.locator('.teaching-panel-actions button').nth(1);
  const buttonText = (await button.textContent())?.trim() ?? '';
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
  return { buttonText, declaredCount, disabled, links, verificationText };
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
    maximumFocusedEntities: mobile ? 2 : 3,
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

function gateHierarchy(
  diagnostics: SceneDiagnostics,
  minimums: HierarchyMinimums | undefined,
): string[] {
  const failures: string[] = [];
  // Logical and Traffic grammars intentionally project Pods without physical Node chassis.
  // In those views, a scheduled Pod being outside a bay is the expected orthogonal projection,
  // not a containment failure. Enforce Node-local diagnostics whenever a Node chassis is visible;
  // keep projection-independent overlap/containment diagnostics active in every grammar.
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
  const failures: string[] = [];
  const { diagnostics, labels, teaching, sources, density, overflow } = inspection;
  if (inspection.documentLanguage !== capture.locale) {
    failures.push(
      `document lang=${String(inspection.documentLanguage)}; expected ${capture.locale}`,
    );
  }
  if (inspection.view !== capture.expectedView) {
    failures.push(`view=${String(inspection.view)}; expected ${capture.expectedView}`);
  }
  if (diagnostics.cameraMode !== 'orthographic') {
    failures.push(`lesson camera=${diagnostics.cameraMode}; expected orthographic`);
  }
  if (diagnostics.entityHandles < 1) failures.push('scene has no rendered entities');
  if (diagnostics.entityHandles > density.maximumEntityHandles) {
    failures.push(
      `entityHandles=${String(diagnostics.entityHandles)} exceeds ${density.viewportClass} grammar ceiling ${String(density.maximumEntityHandles)}`,
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
  if (density.focusedEntityRecords.length > density.maximumFocusedEntities) {
    failures.push(
      `focused entity records=${String(density.focusedEntityRecords.length)} exceeds ${String(density.maximumFocusedEntities)}`,
    );
  }
  if (density.focusedEntityRecords.length < capture.minimumFocusedEntities) {
    failures.push(
      `focused entity records=${String(density.focusedEntityRecords.length)}; expected >=${String(capture.minimumFocusedEntities)}`,
    );
  }
  if (diagnostics.relationHandles < capture.minimumRelations) {
    failures.push(
      `relationHandles=${String(diagnostics.relationHandles)}; expected >=${String(capture.minimumRelations)}`,
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
    failures.push(
      'settled capture retains animation, camera transition, exit handle, or flow token',
    );
  }
  const teachingSections = [
    ['What changed', teaching.whatChanged],
    ['Why', teaching.whyItHappened],
    ['Takeaway', teaching.takeaway],
  ] as const;
  for (const [name, section] of teachingSections) {
    if (!section.visible) failures.push(`${name} section is not visible`);
    if (!section.heading) failures.push(`${name} heading is empty`);
    if (!section.body) failures.push(`${name} body is empty`);
  }
  if (!teaching.evidence.visible) failures.push('Evidence panel is not visible');
  if (teaching.evidence.rows.length < 1 || teaching.evidence.emptyText) {
    failures.push('Representative step must expose at least one factual Evidence row');
  }
  if (capture.viewport.width <= MOBILE_BREAKPOINT && !teaching.mobileSheetExpanded) {
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
  if (!/Verified\s+\d{4}-\d{2}-\d{2}/.test(sources.verificationText)) {
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
  failures.push(...gateHierarchy(diagnostics, capture.hierarchy));
  if (capture.route) {
    failures.push(...gateRoute(diagnostics));
    if (labels.counts.route < 1) failures.push('persistent route has no visible route label');
    if (!inspection.accessibleSummary.includes(' route:')) {
      failures.push('accessible scene summary does not describe the persistent route');
    }
  }
  return failures;
}

async function inspectCapture(page: Page, capture: CaptureCase, phase: Phase) {
  const sources = await inspectSources(page);
  await waitForSettledScene(page, capture.route);
  const diagnostics = await getDiagnostics(page);
  const labels = await inspectLabels(page, diagnostics, capture.locale);
  const viewText = (await page.locator('.lesson-stage-frame > .view-badge').textContent()) ?? '';
  const view = viewText.trim().toLowerCase().replaceAll(/\s+/g, '-') as ViewMode;
  const teaching = await inspectTeaching(page);
  const overflow = await inspectHorizontalOverflow(page);
  const screenshot = `m7-${capture.id}-${capture.viewportId}-${capture.locale}-${phase}.png`;
  const inspection = {
    phase,
    screenshot,
    documentLanguage: await page.locator('html').getAttribute('lang'),
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
    const deadline = performance.now() + 1_500;
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
await Promise.all([
  rm(path.join(outputDirectory, 'm7-lesson-visual-manifest.json'), { force: true }),
  ...captures.flatMap((capture) =>
    (capture.route ? (['settled', 'reduced-motion'] as const) : (['settled'] as const)).map(
      (phase) =>
        rm(
          path.join(
            outputDirectory,
            `m7-${capture.id}-${capture.viewportId}-${capture.locale}-${phase}.png`,
          ),
          { force: true },
        ),
    ),
  ),
]);

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
    const reducedContext = capture.route
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

const reducedCaptureCount = captures.filter((capture) => capture.route).length;
const manifest = {
  generatedAt: new Date().toISOString(),
  milestone: 7,
  baseUrl,
  status: gateFailures.length === 0 ? 'pass' : 'fail',
  coverage: {
    lessons: lessonIds,
    objectives: objectives.map((objective) => ({
      id: objective.id,
      lessonId: objective.lessonId,
      stepId: objective.stepId,
      expectedView: objective.expectedView,
      route: objective.route,
    })),
    viewports: ['1440x900', '1280x720', '1280x800', '390x844'],
    locales: ['en', 'ja', 'zh-CN'],
    settledCases: captures.length,
    reducedMotionCases: reducedCaptureCount,
    screenshots: captures.length + reducedCaptureCount,
    matrix:
      'Every representative objective is captured at 1440x900, one 1280x720/800 risk height, and 390x844. Locale rotation gives every objective EN/JA/zh-CN coverage.',
  },
  gates: {
    allFiveLessonsSchemaV2AndAvailable: true,
    expectedSceneGrammarBadge: true,
    observableGrammarDensityBudget: true,
    focusedEntityLabelRecordsWithinBudget: true,
    relationHandleMinimums: true,
    hierarchyContainmentViolations: 0,
    labelOverlapAndSafeRectViolations: 0,
    teachingFieldsEvidenceTakeawayAndSources: true,
    officialSourcePrefix: 'https://kubernetes.io/',
    staticRouteSafetyViolations: 0,
    reducedMotionFlowTokens: 0,
    maximumFlowTokenRouteDistance: MAXIMUM_TOKEN_ROUTE_DISTANCE,
  },
  failures: gateFailures,
  captures: results,
};

const manifestPath = path.join(outputDirectory, 'm7-lesson-visual-manifest.json');
const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
await writeFile(
  manifestPath,
  await format(JSON.stringify(manifest), { ...prettierConfig, filepath: manifestPath }),
  'utf8',
);

if (gateFailures.length > 0) {
  throw new Error(
    `M7 lesson visual gate failed for ${String(gateFailures.length)} capture(s). See ${manifestPath}.\n${gateFailures.join('\n')}`,
  );
}

console.log(
  `Captured and checked ${String(captures.length)} M7 settled cases plus ${String(reducedCaptureCount)} reduced-motion route cases in ${outputDirectory}.`,
);
