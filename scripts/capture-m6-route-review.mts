/// <reference lib="dom" />

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page, type ViewportSize } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m6');
const MAXIMUM_TOKEN_ROUTE_DISTANCE = 0.02;

type Locale = 'en' | 'ja' | 'zh-CN';
type Story = 'service-request-a' | 'service-request-b' | 'scheduler-bind-worker-c';
type Phase = 'settled' | 'during-replay' | 'after-replay' | 'reduced-motion';

interface SceneDiagnostics {
  readonly activeAnimations: number;
  readonly activeCameraTransitions: number;
  readonly retainedExitHandles: number;
  readonly entityHandles: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly routeMarkers: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
  readonly flowTokens: number;
  readonly activeRouteWidthsBelowMinimum: number;
  readonly visibleRoutesWithoutArrowheads: number;
  readonly routeObstacleIntersections: number;
  readonly routeEndpointDriftCount: number;
  readonly routesOutsideSafeRect: number;
  readonly arrowheadsOutsideSafeRect: number;
  readonly routeMarkersOutsideSafeRect: number;
  readonly flowTokensOffRoute: number;
  readonly maximumFlowTokenRouteDistance: number;
  readonly routeReplanFailures: number;
}

interface CaptureCase {
  readonly id: string;
  readonly story: Story;
  readonly lessonId: string;
  readonly step: number;
  readonly viewport: ViewportSize;
  readonly locale: Locale;
  readonly selectedEndpoint?: 'api-a' | 'api-c';
}

interface PhaseInspection {
  readonly phase: Phase;
  readonly diagnostics: SceneDiagnostics;
  readonly routeLabels: readonly string[];
  readonly accessibleSummary: string;
  readonly evidenceText: string;
  readonly screenshot: string;
  readonly failures: readonly string[];
  readonly normalReplayProbe?: NormalReplayProbe;
  readonly reducedReplayProbe?: ReducedReplayProbe;
}

interface NormalReplayProbe {
  readonly samples: number;
  readonly elapsedMs: number;
  readonly tokenActiveSamples: number;
  readonly samplesAtOrAfterSchedulerDelay: number;
  readonly maxFlowTokens: number;
  readonly maxFlowTokensOffRoute: number;
  readonly maximumFlowTokenRouteDistance: number;
  readonly maxRouteReplanFailures: number;
  readonly maxRouteObstacleIntersections: number;
  readonly maxRouteEndpointDriftCount: number;
  readonly minimumRouteHandles: number;
  readonly minimumArrowheads: number;
  readonly minimumRouteMarkers: number;
  readonly wideLineResourceMismatchSamples: number;
}

interface ReducedReplayProbe {
  readonly samples: number;
  readonly maxFlowTokens: number;
  readonly minRouteHandles: number;
  readonly minArrowheads: number;
  readonly minRouteMarkers: number;
  readonly selectedEndpointEvidenceMissingSamples: number;
  readonly mobileWorkerLabelMissingSamples: number;
}

const viewports = [
  { id: '1440x900', size: { width: 1440, height: 900 } },
  { id: '1280x800', size: { width: 1280, height: 800 } },
  { id: '390x844', size: { width: 390, height: 844 } },
] as const;

const storyDefinitions = [
  {
    story: 'service-request-a',
    lessonId: 'service-routes-to-pods',
    step: 3,
    selectedEndpoint: 'api-a',
    locales: ['en', 'ja', 'zh-CN'],
  },
  {
    story: 'service-request-b',
    lessonId: 'service-routes-to-pods',
    step: 5,
    selectedEndpoint: 'api-c',
    locales: ['ja', 'zh-CN', 'en'],
  },
  {
    story: 'scheduler-bind-worker-c',
    lessonId: 'container-restart-vs-pod-replacement',
    step: 7,
    locales: ['zh-CN', 'en', 'ja'],
  },
] as const satisfies readonly {
  readonly story: Story;
  readonly lessonId: string;
  readonly step: number;
  readonly selectedEndpoint?: 'api-a' | 'api-c';
  readonly locales: readonly [Locale, Locale, Locale];
}[];

const captures: readonly CaptureCase[] = storyDefinitions.flatMap((definition) =>
  viewports.map((viewport, viewportIndex) => ({
    id: `${definition.story}-${viewport.id}-${definition.locales[viewportIndex]}`,
    story: definition.story,
    lessonId: definition.lessonId,
    step: definition.step,
    viewport: viewport.size,
    locale: definition.locales[viewportIndex]!,
    ...('selectedEndpoint' in definition ? { selectedEndpoint: definition.selectedEndpoint } : {}),
  })),
);

const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

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

async function waitForScene(page: Page, predicate: 'settled' | 'token-active'): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(
    (expected) => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      if (!diagnostics || diagnostics.entityHandles < 1 || diagnostics.routeHandles < 1)
        return false;
      if (expected === 'token-active') return diagnostics.flowTokens > 0;
      return (
        diagnostics.flowTokens === 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.activeCameraTransitions === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    predicate,
    { timeout: predicate === 'token-active' ? 5_000 : 20_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  if (predicate === 'settled') await page.waitForTimeout(160);
}

async function waitForTokenActive(page: Page): Promise<SceneDiagnostics> {
  await page.waitForFunction(
    () =>
      ((
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics()?.flowTokens ?? 0) > 0,
    undefined,
    { timeout: 5_000 },
  );
  return await getDiagnostics(page);
}

async function openCase(page: Page, capture: CaptureCase): Promise<void> {
  await page.goto(`${baseUrl}/#/learn/${capture.lessonId}/${String(capture.step)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    (expectedStep) =>
      document.querySelector('.step-timeline [aria-current="step"] span')?.textContent?.trim() ===
      String(expectedStep),
    capture.step + 1,
    { timeout: 20_000 },
  );
  await page.locator('.lesson-language select').selectOption(capture.locale);
  await page.waitForFunction(
    (expectedLocale) => document.documentElement.lang === expectedLocale,
    capture.locale,
  );
  await waitForScene(page, 'settled');
}

async function waitForDisplayedStep(page: Page, displayedStep: number): Promise<void> {
  await page.waitForFunction(
    (expectedStep) =>
      document.querySelector('.step-timeline [aria-current="step"] span')?.textContent?.trim() ===
      String(expectedStep),
    displayedStep,
    { timeout: 10_000 },
  );
}

async function waitForAnimationIdleWithoutRoute(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
        diagnostics.entityHandles > 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.activeCameraTransitions === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function triggerCurrentTransition(page: Page, capture: CaptureCase): Promise<void> {
  if (capture.story !== 'service-request-b') {
    await page.locator('.lesson-header-actions button').first().click();
    return;
  }

  const timelineEdges = page.locator('.step-timeline .timeline-edge-button');
  await timelineEdges.first().click();
  await waitForDisplayedStep(page, capture.step);
  await waitForAnimationIdleWithoutRoute(page);
  await timelineEdges.nth(1).click();
  await waitForDisplayedStep(page, capture.step + 1);
}

async function inspectPhase(
  page: Page,
  capture: CaptureCase,
  phase: Phase,
  screenshot: string,
  options: {
    readonly normalReplayProbe?: NormalReplayProbe;
    readonly reducedReplayProbe?: ReducedReplayProbe;
    readonly diagnostics?: SceneDiagnostics;
  } = {},
): Promise<PhaseInspection> {
  const diagnostics = options.diagnostics ?? (await getDiagnostics(page));
  const routeLabels = await page
    .locator('.scene-route-label:not([hidden])')
    .allTextContents()
    .then((labels) => labels.map((label) => label.trim()).filter(Boolean));
  const accessibleSummary =
    (await page.locator('#scene-accessible-summary').textContent())?.trim() ?? '';
  const evidenceText = (await page.getByTestId('evidence-panel').textContent())?.trim() ?? '';
  const failures = gatePhase(
    capture,
    phase,
    diagnostics,
    routeLabels,
    accessibleSummary,
    evidenceText,
    options.normalReplayProbe,
    options.reducedReplayProbe,
  );

  await page.screenshot({
    path: path.join(outputDirectory, screenshot),
    animations: phase === 'during-replay' ? 'allow' : 'disabled',
    caret: 'hide',
    fullPage: false,
    scale: 'css',
  });

  return {
    phase,
    diagnostics,
    routeLabels,
    accessibleSummary,
    evidenceText,
    screenshot,
    failures,
    ...(options.normalReplayProbe ? { normalReplayProbe: options.normalReplayProbe } : {}),
    ...(options.reducedReplayProbe ? { reducedReplayProbe: options.reducedReplayProbe } : {}),
  };
}

function gateRouteDiagnostics(diagnostics: SceneDiagnostics): string[] {
  const failures: string[] = [];
  if (diagnostics.routeHandles < 1) failures.push('routeHandles must be > 0');
  if (diagnostics.wideLineGeometries !== diagnostics.routeHandles) {
    failures.push(
      `wideLineGeometries=${String(diagnostics.wideLineGeometries)} must equal routeHandles=${String(diagnostics.routeHandles)}`,
    );
  }
  if (diagnostics.wideLineMaterials !== diagnostics.routeHandles) {
    failures.push(
      `wideLineMaterials=${String(diagnostics.wideLineMaterials)} must equal routeHandles=${String(diagnostics.routeHandles)}`,
    );
  }
  const zeroGates = [
    'activeRouteWidthsBelowMinimum',
    'visibleRoutesWithoutArrowheads',
    'routeObstacleIntersections',
    'routeEndpointDriftCount',
    'routesOutsideSafeRect',
    'arrowheadsOutsideSafeRect',
    'routeMarkersOutsideSafeRect',
    'routeReplanFailures',
  ] as const;
  for (const gate of zeroGates) {
    if (diagnostics[gate] !== 0) failures.push(`${gate}=${String(diagnostics[gate])}; expected 0`);
  }
  if (diagnostics.arrowheads < 1) failures.push('persistent route has no arrowheads');
  if (diagnostics.routeMarkers < 1) failures.push('persistent route has no numbered markers');
  if (diagnostics.flowTokensOffRoute !== 0) {
    failures.push(
      `flowTokensOffRoute=${String(diagnostics.flowTokensOffRoute)}; every token must remain on its route`,
    );
  }
  return failures;
}

function gatePhase(
  capture: CaptureCase,
  phase: Phase,
  diagnostics: SceneDiagnostics,
  routeLabels: readonly string[],
  accessibleSummary: string,
  evidenceText: string,
  normalReplayProbe?: NormalReplayProbe,
  reducedReplayProbe?: ReducedReplayProbe,
): string[] {
  const failures = gateRouteDiagnostics(diagnostics);
  if (phase === 'during-replay') {
    if (diagnostics.flowTokens < 1 && (normalReplayProbe?.maxFlowTokens ?? 0) < 1) {
      failures.push('Replay did not lease a flow token');
    }
    if (diagnostics.maximumFlowTokenRouteDistance > MAXIMUM_TOKEN_ROUTE_DISTANCE) {
      failures.push(
        `maximumFlowTokenRouteDistance=${String(diagnostics.maximumFlowTokenRouteDistance)}; expected <=${String(MAXIMUM_TOKEN_ROUTE_DISTANCE)}`,
      );
    }
    if (normalReplayProbe) failures.push(...gateNormalReplayProbe(capture, normalReplayProbe));
  } else if (diagnostics.flowTokens !== 0) {
    failures.push(`flowTokens=${String(diagnostics.flowTokens)}; expected settled/reduced value 0`);
  }

  if (capture.selectedEndpoint) {
    if (!accessibleSummary.includes(`target ${capture.selectedEndpoint}`)) {
      failures.push(`Accessible route summary does not retain target ${capture.selectedEndpoint}`);
    }
    if (!evidenceText.includes(capture.selectedEndpoint)) {
      failures.push(`Evidence does not retain selected endpoint ${capture.selectedEndpoint}`);
    }
  }

  if (capture.story === 'scheduler-bind-worker-c' && capture.viewport.width === 390) {
    if (!routeLabels.some((label) => label.includes('worker-c'))) {
      failures.push('Mobile scheduling route has no visible short label containing worker-c');
    }
  }

  if (phase === 'reduced-motion') {
    if (!reducedReplayProbe) {
      failures.push('Reduced-motion replay was not sampled');
    } else {
      if (reducedReplayProbe.samples < 2)
        failures.push('Reduced-motion replay had too few samples');
      if (reducedReplayProbe.maxFlowTokens !== 0) {
        failures.push(
          `Reduced-motion replay leased ${String(reducedReplayProbe.maxFlowTokens)} flow token(s)`,
        );
      }
      if (reducedReplayProbe.minRouteHandles < 1) {
        failures.push('Persistent route disappeared during reduced-motion replay');
      }
      if (reducedReplayProbe.minArrowheads < 1) {
        failures.push('Arrowheads disappeared during reduced-motion replay');
      }
      if (reducedReplayProbe.minRouteMarkers < 1) {
        failures.push('Numbered markers disappeared during reduced-motion replay');
      }
      if (reducedReplayProbe.selectedEndpointEvidenceMissingSamples !== 0) {
        failures.push(
          `Selected endpoint evidence disappeared in ${String(reducedReplayProbe.selectedEndpointEvidenceMissingSamples)} reduced-motion sample(s)`,
        );
      }
      if (reducedReplayProbe.mobileWorkerLabelMissingSamples !== 0) {
        failures.push(
          `worker-c route label disappeared in ${String(reducedReplayProbe.mobileWorkerLabelMissingSamples)} reduced-motion mobile sample(s)`,
        );
      }
    }
  }
  return failures;
}

async function probeReducedReplay(page: Page, capture: CaptureCase): Promise<ReducedReplayProbe> {
  return await page.evaluate(
    async ({ selectedEndpoint, requireMobileWorkerLabel }) => {
      const probe = {
        samples: 0,
        maxFlowTokens: 0,
        minRouteHandles: Number.POSITIVE_INFINITY,
        minArrowheads: Number.POSITIVE_INFINITY,
        minRouteMarkers: Number.POSITIVE_INFINITY,
        selectedEndpointEvidenceMissingSamples: 0,
        mobileWorkerLabelMissingSamples: 0,
      };
      const deadline = performance.now() + 1_800;
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
          if (selectedEndpoint) {
            const summary = document.querySelector('#scene-accessible-summary')?.textContent ?? '';
            const evidence =
              document.querySelector('[data-testid="evidence-panel"]')?.textContent ?? '';
            if (
              !summary.includes(`target ${selectedEndpoint}`) ||
              !evidence.includes(selectedEndpoint)
            ) {
              probe.selectedEndpointEvidenceMissingSamples += 1;
            }
          }
          if (requireMobileWorkerLabel) {
            const labels = [
              ...document.querySelectorAll<HTMLElement>('.scene-route-label:not([hidden])'),
            ];
            if (!labels.some((label) => label.textContent?.includes('worker-c'))) {
              probe.mobileWorkerLabelMissingSamples += 1;
            }
          }
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return probe;
    },
    {
      selectedEndpoint: capture.selectedEndpoint ?? null,
      requireMobileWorkerLabel:
        capture.story === 'scheduler-bind-worker-c' && capture.viewport.width === 390,
    },
  );
}

function gateNormalReplayProbe(capture: CaptureCase, probe: NormalReplayProbe): string[] {
  const failures: string[] = [];
  if (probe.samples < 10) failures.push(`Normal replay had only ${String(probe.samples)} samples`);
  if (probe.tokenActiveSamples < 1 || probe.maxFlowTokens < 1) {
    failures.push('Normal replay never sampled an active routed token');
  }
  if (capture.story === 'scheduler-bind-worker-c' && probe.samplesAtOrAfterSchedulerDelay < 1) {
    failures.push('Scheduler replay sampling did not cross the 560ms layout-delay boundary');
  }
  const zeroMaximums = [
    ['maxFlowTokensOffRoute', probe.maxFlowTokensOffRoute],
    ['maxRouteReplanFailures', probe.maxRouteReplanFailures],
    ['maxRouteObstacleIntersections', probe.maxRouteObstacleIntersections],
    ['maxRouteEndpointDriftCount', probe.maxRouteEndpointDriftCount],
    ['wideLineResourceMismatchSamples', probe.wideLineResourceMismatchSamples],
  ] as const;
  for (const [name, value] of zeroMaximums) {
    if (value !== 0) failures.push(`${name}=${String(value)}; expected 0 throughout replay`);
  }
  if (probe.maximumFlowTokenRouteDistance > MAXIMUM_TOKEN_ROUTE_DISTANCE) {
    failures.push(
      `maximumFlowTokenRouteDistance=${String(probe.maximumFlowTokenRouteDistance)}; expected <=${String(MAXIMUM_TOKEN_ROUTE_DISTANCE)} throughout replay`,
    );
  }
  if (probe.minimumRouteHandles < 1) failures.push('Persistent route disappeared during replay');
  if (probe.minimumArrowheads < 1) failures.push('Arrowheads disappeared during replay');
  if (probe.minimumRouteMarkers < 1) failures.push('Numbered markers disappeared during replay');
  return failures;
}

async function probeNormalReplay(page: Page): Promise<NormalReplayProbe> {
  const durationMs = 1_800;
  const maximumDurationMs = 6_000;
  const startedAt = performance.now();
  const probe = {
    samples: 0,
    elapsedMs: 0,
    tokenActiveSamples: 0,
    samplesAtOrAfterSchedulerDelay: 0,
    maxFlowTokens: 0,
    maxFlowTokensOffRoute: 0,
    maximumFlowTokenRouteDistance: 0,
    maxRouteReplanFailures: 0,
    maxRouteObstacleIntersections: 0,
    maxRouteEndpointDriftCount: 0,
    minimumRouteHandles: Number.POSITIVE_INFINITY,
    minimumArrowheads: Number.POSITIVE_INFINITY,
    minimumRouteMarkers: Number.POSITIVE_INFINITY,
    wideLineResourceMismatchSamples: 0,
  };
  while (
    (performance.now() - startedAt < durationMs || probe.samples < 10) &&
    performance.now() - startedAt < maximumDurationMs
  ) {
    const diagnostics = await getDiagnostics(page);
    probe.elapsedMs = performance.now() - startedAt;
    probe.samples += 1;
    if (probe.elapsedMs >= 560) probe.samplesAtOrAfterSchedulerDelay += 1;
    if (diagnostics.flowTokens > 0) probe.tokenActiveSamples += 1;
    probe.maxFlowTokens = Math.max(probe.maxFlowTokens, diagnostics.flowTokens);
    probe.maxFlowTokensOffRoute = Math.max(
      probe.maxFlowTokensOffRoute,
      diagnostics.flowTokensOffRoute,
    );
    probe.maximumFlowTokenRouteDistance = Math.max(
      probe.maximumFlowTokenRouteDistance,
      diagnostics.maximumFlowTokenRouteDistance,
    );
    probe.maxRouteReplanFailures = Math.max(
      probe.maxRouteReplanFailures,
      diagnostics.routeReplanFailures,
    );
    probe.maxRouteObstacleIntersections = Math.max(
      probe.maxRouteObstacleIntersections,
      diagnostics.routeObstacleIntersections,
    );
    probe.maxRouteEndpointDriftCount = Math.max(
      probe.maxRouteEndpointDriftCount,
      diagnostics.routeEndpointDriftCount,
    );
    probe.minimumRouteHandles = Math.min(probe.minimumRouteHandles, diagnostics.routeHandles);
    probe.minimumArrowheads = Math.min(probe.minimumArrowheads, diagnostics.arrowheads);
    probe.minimumRouteMarkers = Math.min(probe.minimumRouteMarkers, diagnostics.routeMarkers);
    if (
      diagnostics.wideLineGeometries !== diagnostics.routeHandles ||
      diagnostics.wideLineMaterials !== diagnostics.routeHandles
    ) {
      probe.wideLineResourceMismatchSamples += 1;
    }
    await page.waitForTimeout(16);
  }
  return probe;
}

async function captureNormal(
  context: BrowserContext,
  capture: CaptureCase,
): Promise<readonly PhaseInspection[]> {
  const page = await context.newPage();
  try {
    await openCase(page, capture);
    const settled = await inspectPhase(page, capture, 'settled', `m6-${capture.id}-settled.png`);

    await triggerCurrentTransition(page, capture);
    const normalReplayProbe = await probeNormalReplay(page);
    await waitForScene(page, 'settled');
    await triggerCurrentTransition(page, capture);
    const tokenDiagnostics = await waitForTokenActive(page);
    const during = await inspectPhase(
      page,
      capture,
      'during-replay',
      `m6-${capture.id}-during-replay.png`,
      { normalReplayProbe, diagnostics: tokenDiagnostics },
    );
    await waitForScene(page, 'settled');
    const after = await inspectPhase(
      page,
      capture,
      'after-replay',
      `m6-${capture.id}-after-replay.png`,
    );
    return [settled, during, after];
  } finally {
    await page.close();
  }
}

async function captureReduced(
  context: BrowserContext,
  capture: CaptureCase,
): Promise<PhaseInspection> {
  const page = await context.newPage();
  try {
    await openCase(page, capture);
    await triggerCurrentTransition(page, capture);
    const reducedReplayProbe = await probeReducedReplay(page, capture);
    await waitForScene(page, 'settled');
    return await inspectPhase(
      page,
      capture,
      'reduced-motion',
      `m6-${capture.id}-reduced-motion.png`,
      { reducedReplayProbe },
    );
  } finally {
    await page.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  rm(path.join(outputDirectory, 'm6-route-visual-manifest.json'), { force: true }),
  ...captures.flatMap((capture) =>
    (['settled', 'during-replay', 'after-replay', 'reduced-motion'] as const).map((phase) =>
      rm(path.join(outputDirectory, `m6-${capture.id}-${phase}.png`), { force: true }),
    ),
  ),
]);
const browser = await chromium.launch({ headless: true });
const results: Array<{
  readonly capture: CaptureCase;
  readonly status: 'pass' | 'fail';
  readonly failures: readonly string[];
  readonly phases: readonly PhaseInspection[];
}> = [];
const gateFailures: string[] = [];

try {
  for (const capture of captures) {
    const locale =
      capture.locale === 'ja' ? 'ja-JP' : capture.locale === 'zh-CN' ? 'zh-CN' : 'en-US';
    const normalContext = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale,
      reducedMotion: 'no-preference',
      deviceScaleFactor: 1,
    });
    const reducedContext = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale,
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });

    let phases: readonly PhaseInspection[] = [];
    let failures: string[] = [];
    try {
      const normalPhases = await captureNormal(normalContext, capture);
      const reducedPhase = await captureReduced(reducedContext, capture);
      phases = [...normalPhases, reducedPhase];
      failures = phases.flatMap((phase) =>
        phase.failures.map((failure) => `${phase.phase}: ${failure}`),
      );
    } catch (error: unknown) {
      failures = [errorText(error)];
    } finally {
      await normalContext.close();
      await reducedContext.close();
    }

    if (failures.length > 0) gateFailures.push(`${capture.id}: ${failures.join('; ')}`);
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

const manifest = {
  generatedAt: new Date().toISOString(),
  milestone: 6,
  baseUrl,
  status: gateFailures.length === 0 ? 'pass' : 'fail',
  coverage: {
    stories: storyDefinitions.map((story) => story.story),
    viewports: viewports.map((viewport) => viewport.id),
    locales: ['en', 'ja', 'zh-CN'],
    phases: ['settled', 'during-replay', 'after-replay', 'reduced-motion'],
    captureCases: captures.length,
    screenshots: captures.length * 4,
    matrix:
      'Request A, Request B, and scheduler step 7 are each checked at 1440x900, 1280x800, and 390x844. Locale rotation gives every story and viewport representative EN/JA/zh-CN coverage.',
  },
  gates: {
    persistentRouteBeforeDuringAfterMotion: true,
    replayLeasesFlowToken: true,
    settledAndReducedMotionFlowTokens: 0,
    wideLineResourcesEqualRouteHandles: true,
    activeRouteWidthsBelowMinimum: 0,
    visibleRoutesWithoutArrowheads: 0,
    flowTokensOffRoute: 0,
    maximumFlowTokenRouteDistance: MAXIMUM_TOKEN_ROUTE_DISTANCE,
    routeObstacleIntersections: 0,
    routeEndpointDriftCount: 0,
    routesOutsideSafeRect: 0,
    arrowheadsOutsideSafeRect: 0,
    routeMarkersOutsideSafeRect: 0,
    reducedMotionRetainsRouteArrowMarkerAndSelectedEndpointEvidence: true,
    mobileSchedulerRouteLabelContains: 'worker-c',
  },
  failures: gateFailures,
  captures: results,
};

const manifestPath = path.join(outputDirectory, 'm6-route-visual-manifest.json');
const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
await writeFile(
  manifestPath,
  await format(JSON.stringify(manifest), { ...prettierConfig, filepath: manifestPath }),
  'utf8',
);

if (gateFailures.length > 0) {
  throw new Error(
    `M6 route visual gate failed for ${String(gateFailures.length)} capture(s). See ${manifestPath}.\n${gateFailures.join('\n')}`,
  );
}

console.log(
  `Captured and checked ${String(captures.length)} M6 route cases (${String(captures.length * 4)} screenshots) in ${outputDirectory}.`,
);
