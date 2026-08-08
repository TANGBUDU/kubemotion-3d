/// <reference lib="dom" />

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m5');
const goldenLessonId = 'container-restart-vs-pod-replacement';
const serviceLessonId = 'service-routes-to-pods';

const MOBILE_BREAKPOINT = 720;
const MOBILE_LABEL_LIMIT = 3;
const MOBILE_SCENE_MIN_RATIO = 0.48;
const MOBILE_SCENE_MAX_RATIO = 0.55;
const MINIMUM_SCENE_TEXT_CSS_PX = 10;
const GEOMETRY_TOLERANCE_PX = 0.75;

type Locale = 'en' | 'ja' | 'zh-CN';
type Topic =
  'overview' | 'pod-container' | 'service-traffic' | 'container-restart' | 'pending-scheduling';
type CameraMode = 'orthographic' | 'perspective';

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SceneDiagnostics {
  readonly cameraMode: CameraMode;
  readonly safeViewportExclusions: number;
  readonly safeRectX: number;
  readonly safeRectY: number;
  readonly safeRectWidth: number;
  readonly safeRectHeight: number;
  readonly subjectScreenWidthRatio: number;
  readonly subjectScreenHeightRatio: number;
  readonly routesOutsideSafeRect: number;
  readonly focusedEntitiesOutsideSafeRect: number;
  readonly sceneBoundsOutsideContentRect: number;
  readonly entityHandles: number;
  readonly labels: number;
  readonly callouts: number;
  readonly activeAnimations: number;
  readonly activeCameraTransitions: number;
  readonly retainedExitHandles: number;
  readonly foundationMeshes: number;
  readonly nodeHandles: number;
  readonly podHandles: number;
  readonly containedContainers: number;
  readonly containersOutsidePods: number;
  readonly scheduledPodsOutsideBays: number;
  readonly pendingPods: number;
  readonly pendingPodsInsideNodes: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly routeMarkers: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
  readonly flowTokens: number;
  readonly [key: string]: number | CameraMode;
}

interface RequiredRoute {
  readonly minimumArrowheads: number;
  readonly minimumMarkers: number;
}

type CaptureRoute =
  | { readonly kind: 'explore'; readonly view: 'overview' | 'placement' }
  | { readonly kind: 'lesson'; readonly lessonId: string; readonly step: number };

interface Capture {
  readonly id: string;
  readonly file: string;
  readonly topic: Topic;
  readonly viewport: ViewportSize;
  readonly locale: Locale;
  readonly cameraMode: CameraMode;
  readonly route: CaptureRoute;
  readonly requiredRoute?: RequiredRoute;
}

interface LabelRecord {
  readonly key: string;
  readonly text: string;
  readonly source: 'entity' | 'layout' | 'route' | 'callout' | 'other';
  readonly lang: string | null;
  readonly fontSize: number;
  readonly box: Rectangle | null;
}

const viewports = [
  { id: '1440x900', size: { width: 1440, height: 900 } },
  { id: '1280x720', size: { width: 1280, height: 720 } },
  { id: '390x844', size: { width: 390, height: 844 } },
] as const;

const topicRoutes: Readonly<Record<Topic, CaptureRoute>> = {
  overview: { kind: 'explore', view: 'overview' },
  'pod-container': { kind: 'explore', view: 'placement' },
  'service-traffic': { kind: 'lesson', lessonId: serviceLessonId, step: 5 },
  'container-restart': { kind: 'lesson', lessonId: goldenLessonId, step: 3 },
  'pending-scheduling': { kind: 'lesson', lessonId: goldenLessonId, step: 6 },
};

const topicLocales: Readonly<Record<Topic, readonly [Locale, Locale, Locale]>> = {
  overview: ['en', 'ja', 'zh-CN'],
  'pod-container': ['ja', 'zh-CN', 'en'],
  'service-traffic': ['zh-CN', 'en', 'ja'],
  'container-restart': ['en', 'ja', 'zh-CN'],
  'pending-scheduling': ['ja', 'zh-CN', 'en'],
};

const topicCameraModes: Readonly<Record<Topic, readonly [CameraMode, CameraMode, CameraMode]>> = {
  overview: ['perspective', 'orthographic', 'perspective'],
  'pod-container': ['orthographic', 'perspective', 'orthographic'],
  'service-traffic': ['orthographic', 'orthographic', 'orthographic'],
  'container-restart': ['orthographic', 'orthographic', 'orthographic'],
  'pending-scheduling': ['orthographic', 'orthographic', 'orthographic'],
};

const requiredRoutes: Partial<Record<Topic, RequiredRoute>> = {
  'service-traffic': { minimumArrowheads: 4, minimumMarkers: 2 },
  'container-restart': { minimumArrowheads: 1, minimumMarkers: 1 },
};

const topics = Object.keys(topicRoutes) as Topic[];
const captures: readonly Capture[] = topics.flatMap((topic) =>
  viewports.map((viewport, viewportIndex) => {
    const locale = topicLocales[topic][viewportIndex]!;
    const cameraMode = topicCameraModes[topic][viewportIndex]!;
    const localeSlug = locale.toLowerCase();
    return {
      id: `${topic}-${viewport.id}-${localeSlug}`,
      file: `m5-${topic}-${viewport.id}-${localeSlug}.png`,
      topic,
      viewport: viewport.size,
      locale,
      cameraMode,
      route: topicRoutes[topic],
      ...(requiredRoutes[topic] ? { requiredRoute: requiredRoutes[topic] } : {}),
    };
  }),
);

const exploreExclusionSelectors = [
  '.app-header',
  '.explore-tools',
  '.inspector',
  '.view-tabs',
  '.explore-camera-controls',
  '.scene-legend',
  '.scene-caption',
] as const;

const lessonExclusionSelectors = [
  '.lesson-header',
  '.mobile-teaching-sheet',
  '.step-timeline',
  '.inspector-drawer:not([hidden])',
] as const;

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

const overlapRatio = (left: Rectangle, right: Rectangle): number => {
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea <= 0 ? 0 : intersectionArea(left, right) / smallerArea;
};

const inside = (inner: Rectangle, outer: Rectangle, tolerance = GEOMETRY_TOLERANCE_PX): boolean =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance;

const errorText = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const getDiagnostics = async (page: Page): Promise<SceneDiagnostics> => {
  const diagnostics = await page.evaluate(() =>
    (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');
  return diagnostics;
};

async function waitForSettledScene(page: Page): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
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
        diagnostics.safeRectWidth > 0 &&
        diagnostics.safeRectHeight > 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.activeCameraTransitions === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForTimeout(240);
}

async function selectLocale(page: Page, capture: Capture): Promise<void> {
  const selector =
    capture.route.kind === 'lesson' ? '.lesson-language select' : '.app-header #locale';
  await page.locator(selector).selectOption(capture.locale);
  await page.waitForFunction((expectedLocale) => {
    const state = (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getAppState: () => Readonly<Record<string, unknown>> };
      }
    ).__KUBEMOTION_TEST__?.getAppState();
    return document.documentElement.lang === expectedLocale && state?.locale === expectedLocale;
  }, capture.locale);
  await waitForSettledScene(page);
}

async function setExploreCameraMode(page: Page, mode: CameraMode): Promise<void> {
  const buttons = page.locator('.explore-camera-controls button[aria-pressed]');
  if ((await buttons.count()) !== 2) {
    throw new Error('Explore projection control must expose two aria-pressed buttons');
  }
  await buttons.nth(mode === 'orthographic' ? 0 : 1).click();
  await page.waitForFunction(
    (expectedMode) =>
      document.querySelector('[data-testid="scene-viewport"]')?.getAttribute('data-camera-mode') ===
      expectedMode,
    mode,
  );
  await waitForSettledScene(page);
}

async function openCapture(page: Page, capture: Capture): Promise<void> {
  if (capture.route.kind === 'lesson') {
    await page.goto(`${baseUrl}/#/learn/${capture.route.lessonId}/${String(capture.route.step)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      (expectedStep) =>
        document.querySelector('.step-timeline [aria-current="step"] span')?.textContent?.trim() ===
        String(expectedStep),
      capture.route.step + 1,
      { timeout: 20_000 },
    );
    await waitForSettledScene(page);
    await selectLocale(page, capture);
    return;
  }

  await page.goto(`${baseUrl}/#/explore`, { waitUntil: 'domcontentloaded' });
  await waitForSettledScene(page);
  await selectLocale(page, capture);
  if (capture.route.view !== 'overview') {
    await page.locator(`#explore-view-tab-${capture.route.view}`).click();
    await waitForSettledScene(page);
  }
  if (capture.topic === 'pod-container') {
    await page.locator('.explore-tools input').fill('api-7f8d9-a');
    await waitForSettledScene(page);
  }
  await setExploreCameraMode(page, capture.cameraMode);
}

async function inspectLabels(page: Page, diagnostics: SceneDiagnostics) {
  const locator = page.locator(
    '.scene-viewport .scene-label:visible, .scene-viewport .scene-callout:visible',
  );
  const metadata = await locator.evaluateAll((elements) =>
    elements.map((element, index) => {
      const html = element as HTMLElement;
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
          html.dataset.calloutId ??
          html.dataset.routeLabelId ??
          html.dataset.layoutLabelId ??
          `visible-label-${String(index)}`,
        text: html.textContent?.trim() ?? '',
        source,
        lang: html.getAttribute('lang'),
        fontSize: Number.parseFloat(getComputedStyle(html).fontSize),
      };
    }),
  );
  const boxes = await Promise.all(
    Array.from({ length: await locator.count() }, (_, index) => locator.nth(index).boundingBox()),
  );
  const labels: LabelRecord[] = metadata.map((record, index) => ({
    ...record,
    source: record.source as LabelRecord['source'],
    box: boxes[index] ?? null,
  }));
  const stage = await page.getByTestId('scene-render-host').boundingBox();
  if (!stage) throw new Error('Scene render host has no measurable bounds');
  const safeRect: Rectangle = {
    x: stage.x + diagnostics.safeRectX,
    y: stage.y + diagnostics.safeRectY,
    width: diagnostics.safeRectWidth,
    height: diagnostics.safeRectHeight,
  };
  const labelsWithBoxes = labels.filter(
    (label): label is LabelRecord & { readonly box: Rectangle } => label.box !== null,
  );
  const overlappingPairs: Array<{
    readonly left: string;
    readonly right: string;
    readonly overlapRatio: number;
  }> = [];
  let maximumOverlapRatio = 0;
  for (let left = 0; left < labelsWithBoxes.length; left += 1) {
    for (let right = left + 1; right < labelsWithBoxes.length; right += 1) {
      const leftLabel = labelsWithBoxes[left];
      const rightLabel = labelsWithBoxes[right];
      if (!leftLabel || !rightLabel) continue;
      const area = intersectionArea(leftLabel.box, rightLabel.box);
      if (area <= 0.25) continue;
      const ratio = overlapRatio(leftLabel.box, rightLabel.box);
      maximumOverlapRatio = Math.max(maximumOverlapRatio, ratio);
      overlappingPairs.push({ left: leftLabel.key, right: rightLabel.key, overlapRatio: ratio });
    }
  }
  const counts = {
    total: labels.length,
    entity: labels.filter((label) => label.source === 'entity').length,
    layout: labels.filter((label) => label.source === 'layout').length,
    route: labels.filter((label) => label.source === 'route').length,
    callout: labels.filter((label) => label.source === 'callout').length,
    other: labels.filter((label) => label.source === 'other').length,
  };
  return {
    counts,
    records: labels,
    missingBounds: labels.filter((label) => label.box === null).map((label) => label.key),
    labelsOutsideStage: labelsWithBoxes
      .filter((label) => !inside(label.box, stage))
      .map((label) => label.key),
    labelsOutsideSafeRect: labelsWithBoxes
      .filter((label) => !inside(label.box, safeRect))
      .map((label) => label.key),
    languageMismatches: labels
      .filter((label) => label.lang !== null && label.lang !== documentLanguagePlaceholder)
      .map((label) => ({ key: label.key, lang: label.lang })),
    overlappingPairs,
    maximumOverlapRatio,
    stage,
    safeRect,
  };
}

// Kept as a unique sentinel so inspectLabels can replace it without relying on closure
// serialization inside page.evaluate calls.
const documentLanguagePlaceholder = '__CURRENT_CAPTURE_LOCALE__';

async function inspectSceneText(page: Page) {
  const selector = [
    '.scene-viewport .scene-label:visible',
    '.scene-viewport .scene-callout:visible',
    '.lesson-stage-frame > .view-badge:visible',
    '.scene-legend > strong:visible',
    '.scene-legend li > span:last-child:visible',
    '.explore-stage .scene-caption:visible',
  ].join(', ');
  const records = await page.locator(selector).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const html = element as HTMLElement;
      const text = html.textContent?.trim() ?? '';
      if (!text) return [];
      return [
        {
          selector: html.className || html.tagName.toLowerCase(),
          text,
          fontSize: Number.parseFloat(getComputedStyle(html).fontSize),
        },
      ];
    }),
  );
  return {
    records,
    minimumFontSize:
      records.length === 0 ? null : Math.min(...records.map((record) => record.fontSize)),
    tinyText: records.filter((record) => record.fontSize < MINIMUM_SCENE_TEXT_CSS_PX),
  };
}

async function inspectHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentScrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const root = document.getElementById('root');
    const main = document.querySelector('.lesson-shell, .explore-page');
    const rootRect = root?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    return {
      viewportWidth,
      documentScrollWidth,
      overflowPixels: Math.max(0, documentScrollWidth - viewportWidth),
      rootScrollWidth: root?.scrollWidth ?? 0,
      rootClientWidth: root?.clientWidth ?? 0,
      rootRect: rootRect
        ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height }
        : null,
      mainRect: mainRect
        ? { x: mainRect.x, y: mainRect.y, width: mainRect.width, height: mainRect.height }
        : null,
    };
  });
}

async function inspectSafeViewport(page: Page, capture: Capture, diagnostics: SceneDiagnostics) {
  const selectors =
    capture.route.kind === 'explore' ? exploreExclusionSelectors : lessonExclusionSelectors;
  const measured = await page.evaluate(
    ({ exclusionSelectors }) => {
      const host = document.querySelector<HTMLElement>('[data-testid="scene-render-host"]');
      if (!host) throw new Error('Scene render host is missing');
      const hostRect = host.getBoundingClientRect();
      const candidates = [
        ...new Set(
          exclusionSelectors.flatMap((selector) => [
            ...document.querySelectorAll<HTMLElement>(selector),
          ]),
        ),
      ];
      const exclusions = candidates.flatMap((element) => {
        const style = getComputedStyle(element);
        if (element.hidden || style.display === 'none' || style.visibility === 'hidden') return [];
        const rect = element.getBoundingClientRect();
        const left = Math.max(hostRect.left, rect.left);
        const top = Math.max(hostRect.top, rect.top);
        const right = Math.min(hostRect.right, rect.right);
        const bottom = Math.min(hostRect.bottom, rect.bottom);
        if (right <= left || bottom <= top) return [];
        return [
          {
            selector: exclusionSelectors.find((selector) => element.matches(selector)) ?? 'unknown',
            x: left - hostRect.left,
            y: top - hostRect.top,
            width: right - left,
            height: bottom - top,
          },
        ];
      });
      return {
        host: { x: 0, y: 0, width: hostRect.width, height: hostRect.height },
        exclusions,
      };
    },
    { exclusionSelectors: [...selectors] },
  );
  const safeRect: Rectangle = {
    x: diagnostics.safeRectX,
    y: diagnostics.safeRectY,
    width: diagnostics.safeRectWidth,
    height: diagnostics.safeRectHeight,
  };
  const overlappingExclusionPairs: Array<{ readonly left: string; readonly right: string }> = [];
  for (let left = 0; left < measured.exclusions.length; left += 1) {
    for (let right = left + 1; right < measured.exclusions.length; right += 1) {
      const leftExclusion = measured.exclusions[left];
      const rightExclusion = measured.exclusions[right];
      if (
        leftExclusion &&
        rightExclusion &&
        intersectionArea(leftExclusion, rightExclusion) > 0.25
      ) {
        overlappingExclusionPairs.push({
          left: leftExclusion.selector,
          right: rightExclusion.selector,
        });
      }
    }
  }
  return {
    ...measured,
    diagnosticExclusionCount: diagnostics.safeViewportExclusions,
    safeRect,
    safeRectInsideHost: inside(safeRect, measured.host),
    safeRectAreaRatio:
      (safeRect.width * safeRect.height) / (measured.host.width * measured.host.height),
    exclusionsOverlappingSafeRect: measured.exclusions
      .filter((exclusion) => intersectionArea(exclusion, safeRect) > 0.25)
      .map((exclusion) => exclusion.selector),
    overlappingExclusionPairs,
  };
}

async function inspectControlClipping(page: Page) {
  return page.evaluate(() => {
    const clippedButtons = [
      ...document.querySelectorAll<HTMLElement>(
        '.explore-tools button, .lesson-completion-actions button, .lesson-completion-actions a, .explore-camera-controls button',
      ),
    ]
      .filter(
        (element) =>
          !element.hidden &&
          getComputedStyle(element).display !== 'none' &&
          element.getClientRects().length > 0,
      )
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map(
        (element) => element.textContent?.trim() || element.getAttribute('aria-label') || 'button',
      );
    const clippedSelects = [
      ...document.querySelectorAll<HTMLSelectElement>('.explore-tools select'),
    ]
      .filter(
        (element) =>
          !element.hidden &&
          getComputedStyle(element).display !== 'none' &&
          element.getClientRects().length > 0,
      )
      .flatMap((element) => {
        const text = element.selectedOptions[0]?.textContent?.trim() ?? '';
        const style = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return [];
        context.font = style.font;
        const available =
          element.clientWidth -
          Number.parseFloat(style.paddingLeft || '0') -
          Number.parseFloat(style.paddingRight || '0') -
          22;
        return context.measureText(text).width > available + 1 ? [text] : [];
      });
    const clippedLegendItems = [
      ...document.querySelectorAll<HTMLElement>('.scene-legend li > span:last-child'),
    ]
      .filter(
        (element) =>
          !element.hidden &&
          getComputedStyle(element).display !== 'none' &&
          element.getClientRects().length > 0,
      )
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.textContent?.trim() ?? 'legend item');
    return { clippedButtons, clippedSelects, clippedLegendItems };
  });
}

async function inspectMobileLessonComposition(page: Page, capture: Capture) {
  if (capture.route.kind !== 'lesson' || capture.viewport.width > MOBILE_BREAKPOINT) return null;
  const sceneCanvas = await page.locator('.scene-canvas').boundingBox();
  const stage = await page.locator('.lesson-stage-frame').boundingBox();
  const teachingSheet = await page.getByTestId('teaching-sheet').boundingBox();
  const teachingBody = await page.locator('#teaching-sheet-body').boundingBox();
  const whatChanged = await page.getByTestId('teaching-what-changed').boundingBox();
  const completionCard = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('.lesson-completion-card');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!sceneCanvas || !stage || !teachingSheet || !teachingBody || !whatChanged) {
    throw new Error('Mobile lesson composition has an unmeasurable scene or teaching region');
  }
  return {
    sceneCanvas,
    stage,
    teachingSheet,
    teachingBody,
    whatChanged,
    completionCard,
    sceneHeightRatio: sceneCanvas.height / capture.viewport.height,
    stageHeightRatio: stage.height / capture.viewport.height,
    teachingHeightRatio: teachingSheet.height / capture.viewport.height,
    teachingSheetExpanded:
      (await page.getByTestId('teaching-sheet').getAttribute('class'))?.includes('is-expanded') ??
      false,
    whatChangedVisible: await page.getByTestId('teaching-what-changed').isVisible(),
    whatChangedFullyVisible: inside(whatChanged, teachingBody, 1),
    completionOverlapsWhatChanged:
      completionCard === null ? false : intersectionArea(completionCard, whatChanged) > 0,
  };
}

async function inspectCapture(page: Page, capture: Capture) {
  const diagnostics = await getDiagnostics(page);
  const labels = await inspectLabels(page, diagnostics);
  labels.languageMismatches.splice(
    0,
    labels.languageMismatches.length,
    ...labels.records
      .filter((label) => label.lang !== null && label.lang !== capture.locale)
      .map((label) => ({ key: label.key, lang: label.lang })),
  );
  return {
    documentLanguage: await page.locator('html').getAttribute('lang'),
    sceneCameraMode: await page.getByTestId('scene-viewport').getAttribute('data-camera-mode'),
    diagnostics,
    labels,
    sceneText: await inspectSceneText(page),
    horizontalOverflow: await inspectHorizontalOverflow(page),
    safeViewport: await inspectSafeViewport(page, capture, diagnostics),
    controlClipping: await inspectControlClipping(page),
    mobileLesson: await inspectMobileLessonComposition(page, capture),
  };
}

function gateCapture(capture: Capture, inspection: Awaited<ReturnType<typeof inspectCapture>>) {
  const failures: string[] = [];
  const {
    diagnostics,
    labels,
    safeViewport,
    horizontalOverflow,
    sceneText,
    mobileLesson,
    controlClipping,
  } = inspection;

  if (inspection.documentLanguage !== capture.locale) {
    failures.push(
      `document lang=${String(inspection.documentLanguage)}; expected ${capture.locale}`,
    );
  }
  if (
    diagnostics.cameraMode !== capture.cameraMode ||
    inspection.sceneCameraMode !== capture.cameraMode
  ) {
    failures.push(
      `camera=${diagnostics.cameraMode}/${String(inspection.sceneCameraMode)}; expected ${capture.cameraMode}`,
    );
  }
  if (diagnostics.entityHandles < 1) failures.push('scene has no rendered entities');
  if (diagnostics.labels + diagnostics.callouts < labels.counts.total) {
    failures.push(
      `managed labels/callouts=${String(diagnostics.labels + diagnostics.callouts)} is below visible teaching labels=${String(labels.counts.total)}`,
    );
  }
  if (labels.counts.other !== 0) {
    failures.push(`unclassified visible scene labels=${String(labels.counts.other)}`);
  }
  if (labels.missingBounds.length > 0) {
    failures.push(`labels without bounds: ${labels.missingBounds.join(', ')}`);
  }
  if (labels.overlappingPairs.length > 0) {
    failures.push(
      `overlapping labels: ${labels.overlappingPairs
        .map((pair) => `${pair.left}/${pair.right}`)
        .join(', ')}`,
    );
  }
  if (labels.labelsOutsideStage.length > 0) {
    failures.push(`labels outside stage: ${labels.labelsOutsideStage.join(', ')}`);
  }
  if (labels.labelsOutsideSafeRect.length > 0) {
    failures.push(`labels outside camera safe rect: ${labels.labelsOutsideSafeRect.join(', ')}`);
  }
  if (labels.languageMismatches.length > 0) {
    failures.push(
      `label lang mismatch: ${labels.languageMismatches
        .map((label) => `${label.key}=${String(label.lang)}`)
        .join(', ')}`,
    );
  }
  if (capture.viewport.width <= MOBILE_BREAKPOINT && labels.counts.total > MOBILE_LABEL_LIMIT) {
    failures.push(
      `mobile visible labels=${String(labels.counts.total)}; expected <=${String(MOBILE_LABEL_LIMIT)}`,
    );
  }
  if (sceneText.tinyText.length > 0) {
    failures.push(
      `scene/legend text below ${String(MINIMUM_SCENE_TEXT_CSS_PX)}px: ${sceneText.tinyText
        .map((record) => `${record.text}=${String(record.fontSize)}px`)
        .join(', ')}`,
    );
  }
  if (horizontalOverflow.overflowPixels > 1) {
    failures.push(`horizontal overflow=${String(horizontalOverflow.overflowPixels)}px`);
  }
  if (
    horizontalOverflow.rootClientWidth > 0 &&
    horizontalOverflow.rootScrollWidth - horizontalOverflow.rootClientWidth > 1
  ) {
    failures.push(
      `root horizontal overflow=${String(
        horizontalOverflow.rootScrollWidth - horizontalOverflow.rootClientWidth,
      )}px`,
    );
  }
  if (!safeViewport.safeRectInsideHost) failures.push('camera safe rect is outside scene host');
  if (safeViewport.safeRectAreaRatio <= 0 || safeViewport.safeRectAreaRatio >= 1) {
    failures.push(`invalid camera safe area ratio=${String(safeViewport.safeRectAreaRatio)}`);
  }
  if (safeViewport.exclusionsOverlappingSafeRect.length > 0) {
    failures.push(
      `safe rect overlaps exclusions: ${safeViewport.exclusionsOverlappingSafeRect.join(', ')}`,
    );
  }
  if (safeViewport.overlappingExclusionPairs.length > 0) {
    failures.push(
      `overlapping UI exclusions: ${safeViewport.overlappingExclusionPairs
        .map((pair) => `${pair.left}/${pair.right}`)
        .join(', ')}`,
    );
  }
  if (
    controlClipping.clippedButtons.length > 0 ||
    controlClipping.clippedSelects.length > 0 ||
    controlClipping.clippedLegendItems.length > 0
  ) {
    failures.push(
      `clipped controls/legend: ${[
        ...controlClipping.clippedButtons,
        ...controlClipping.clippedSelects,
        ...controlClipping.clippedLegendItems,
      ].join(', ')}`,
    );
  }
  if (safeViewport.diagnosticExclusionCount !== safeViewport.exclusions.length) {
    failures.push(
      `safe exclusions diagnostic=${String(
        safeViewport.diagnosticExclusionCount,
      )}; measured=${String(safeViewport.exclusions.length)}`,
    );
  }
  if (capture.route.kind === 'explore' && safeViewport.exclusions.length < 2) {
    failures.push(
      `Explore safe viewport measured ${String(safeViewport.exclusions.length)} exclusions; expected >=2`,
    );
  }
  if (
    diagnostics.activeAnimations !== 0 ||
    diagnostics.activeCameraTransitions !== 0 ||
    diagnostics.retainedExitHandles !== 0
  ) {
    failures.push(
      `scene not settled: activeAnimations=${String(
        diagnostics.activeAnimations,
      )}, activeCameraTransitions=${String(
        diagnostics.activeCameraTransitions,
      )}, retainedExitHandles=${String(diagnostics.retainedExitHandles)}`,
    );
  }

  if (capture.topic === 'overview' && diagnostics.foundationMeshes < 1) {
    failures.push('Overview has no cluster foundation mesh');
  }
  if (
    capture.topic === 'overview' &&
    (diagnostics.subjectScreenWidthRatio < 0.48 ||
      diagnostics.subjectScreenHeightRatio < 0.48 ||
      diagnostics.subjectScreenWidthRatio > 0.97 ||
      diagnostics.subjectScreenHeightRatio > 0.97)
  ) {
    failures.push(
      `Overview subject fill=${(diagnostics.subjectScreenWidthRatio * 100).toFixed(1)}% x ${(diagnostics.subjectScreenHeightRatio * 100).toFixed(1)}%; expected 48-97% on both axes`,
    );
  }
  if (diagnostics.routesOutsideSafeRect !== 0) {
    failures.push(`routesOutsideSafeRect=${String(diagnostics.routesOutsideSafeRect)}; expected 0`);
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
    capture.topic === 'pending-scheduling' &&
    capture.viewport.width <= MOBILE_BREAKPOINT &&
    !labels.records.some((label) => label.key === 'layout:unscheduled-transit-lane')
  ) {
    failures.push('mobile Pending scene is missing the UNSCHEDULED / TRANSIT heading');
  }
  if (capture.topic === 'pod-container') {
    if (diagnostics.nodeHandles < 1 || diagnostics.podHandles < 1) {
      failures.push('Pod/Container capture is missing Node or Pod handles');
    }
    if (diagnostics.containedContainers < 1 || diagnostics.containersOutsidePods !== 0) {
      failures.push(
        `runtime containment invalid: contained=${String(
          diagnostics.containedContainers,
        )}, outside=${String(diagnostics.containersOutsidePods)}`,
      );
    }
    if (diagnostics.scheduledPodsOutsideBays !== 0) {
      failures.push(
        `scheduledPodsOutsideBays=${String(diagnostics.scheduledPodsOutsideBays)}; expected 0`,
      );
    }
  }
  if (capture.topic === 'pending-scheduling') {
    if (diagnostics.pendingPods < 1) failures.push('Pending scheduling capture has no Pending Pod');
    if (diagnostics.pendingPodsInsideNodes !== 0) {
      failures.push(
        `pendingPodsInsideNodes=${String(diagnostics.pendingPodsInsideNodes)}; expected 0`,
      );
    }
  }

  if (capture.requiredRoute) {
    if (diagnostics.routeHandles < 1) failures.push('persistent route handle is missing');
    if (diagnostics.wideLineGeometries < 1 || diagnostics.wideLineMaterials < 1) {
      failures.push('persistent route is not backed by the wide-line renderer');
    }
    if (diagnostics.arrowheads < capture.requiredRoute.minimumArrowheads) {
      failures.push(
        `arrowheads=${String(diagnostics.arrowheads)}; expected >=${String(
          capture.requiredRoute.minimumArrowheads,
        )}`,
      );
    }
    if (diagnostics.routeMarkers < capture.requiredRoute.minimumMarkers) {
      failures.push(
        `routeMarkers=${String(diagnostics.routeMarkers)}; expected >=${String(
          capture.requiredRoute.minimumMarkers,
        )}`,
      );
    }
  }

  if (mobileLesson) {
    if (
      mobileLesson.sceneHeightRatio < MOBILE_SCENE_MIN_RATIO ||
      mobileLesson.sceneHeightRatio > MOBILE_SCENE_MAX_RATIO
    ) {
      failures.push(
        `mobile scene height=${(mobileLesson.sceneHeightRatio * 100).toFixed(
          2,
        )}vh; expected ${String(MOBILE_SCENE_MIN_RATIO * 100)}-${String(
          MOBILE_SCENE_MAX_RATIO * 100,
        )}vh`,
      );
    }
    if (
      !mobileLesson.teachingSheetExpanded ||
      !mobileLesson.whatChangedVisible ||
      !mobileLesson.whatChangedFullyVisible ||
      mobileLesson.completionOverlapsWhatChanged
    ) {
      failures.push(
        'mobile teaching sheet must expose an unobscured, fully visible What changed section',
      );
    }
  }

  return failures;
}

function assertCoverage(): void {
  const failures: string[] = [];
  for (const topic of topics) {
    const topicCaptures = captures.filter((capture) => capture.topic === topic);
    const sizes = new Set(
      topicCaptures.map((capture) => `${capture.viewport.width}x${capture.viewport.height}`),
    );
    const locales = new Set(topicCaptures.map((capture) => capture.locale));
    if (sizes.size !== viewports.length) failures.push(`${topic}: incomplete viewport coverage`);
    if (locales.size !== 3) failures.push(`${topic}: incomplete EN/JA/zh-CN coverage`);
  }
  for (const viewport of viewports) {
    const viewportCaptures = captures.filter(
      (capture) =>
        capture.viewport.width === viewport.size.width &&
        capture.viewport.height === viewport.size.height,
    );
    if (new Set(viewportCaptures.map((capture) => capture.topic)).size !== topics.length) {
      failures.push(`${viewport.id}: incomplete topic coverage`);
    }
    if (new Set(viewportCaptures.map((capture) => capture.locale)).size !== 3) {
      failures.push(`${viewport.id}: incomplete locale coverage`);
    }
  }
  if (failures.length > 0) throw new Error(`Invalid M5 capture matrix: ${failures.join('; ')}`);
}

assertCoverage();
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const results: Array<Record<string, unknown>> = [];
const gateFailures: string[] = [];

try {
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale: capture.locale === 'ja' ? 'ja-JP' : capture.locale === 'zh-CN' ? 'zh-CN' : 'en-US',
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    let inspection: Awaited<ReturnType<typeof inspectCapture>> | undefined;
    let failures: string[] = [];
    try {
      await openCapture(page, capture);
      inspection = await inspectCapture(page, capture);
      failures = gateCapture(capture, inspection);
    } catch (error: unknown) {
      failures = [errorText(error)];
    }

    try {
      await page.screenshot({
        path: path.join(outputDirectory, capture.file),
        animations: 'disabled',
        caret: 'hide',
        fullPage: false,
        scale: 'css',
      });
    } catch (error: unknown) {
      failures.push(`screenshot failed: ${errorText(error)}`);
    }

    if (failures.length > 0) {
      gateFailures.push(`${capture.id}: ${failures.join('; ')}`);
    }
    results.push({
      ...capture,
      status: failures.length === 0 ? 'pass' : 'fail',
      failures,
      inspection,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const manifest = {
  generatedAt: new Date().toISOString(),
  milestone: 5,
  baseUrl,
  status: gateFailures.length === 0 ? 'pass' : 'fail',
  coverage: {
    captureCount: captures.length,
    topics,
    viewports: viewports.map((viewport) => viewport.id),
    locales: ['en', 'ja', 'zh-CN'],
    matrix:
      'Every topic is captured once at 1440x900, 1280x720, and 390x844; locale rotation gives every topic and every viewport EN/JA/zh-CN coverage.',
  },
  gates: {
    allVisibleLabelSources: ['entity', 'layout', 'route', 'callout'],
    mobileTotalVisibleLabelLimit: MOBILE_LABEL_LIMIT,
    labelsOutsideStage: 0,
    labelsOutsideSafeRect: 0,
    overlappingLabelPairs: 0,
    minimumSceneAndLegendTextCssPx: MINIMUM_SCENE_TEXT_CSS_PX,
    horizontalOverflowPixels: 0,
    mobileLessonSceneHeightVh: [MOBILE_SCENE_MIN_RATIO * 100, MOBILE_SCENE_MAX_RATIO * 100],
    mobileTeachingSheetExpanded: true,
    guidedCameraMode: 'orthographic',
    exploreCameraModes: ['orthographic', 'perspective'],
    safeViewportMatchesMeasuredExclusions: true,
    uiExclusionPairsOverlap: 0,
    clippedControlsAndLegendItems: 0,
    overviewSubjectFillRatio: { minimum: 0.48, maximum: 0.97 },
    activeRoutesAndFocusedEntitiesOutsideSafeRect: 0,
    completeSceneBoundsOutsideUiFreeContentRect: 0,
    persistentRoutesRetainWideLinesArrowheadsAndMarkers: true,
  },
  failures: gateFailures,
  captures: results,
};

const manifestPath = path.join(outputDirectory, 'm5-responsive-visual-manifest.json');
const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
await writeFile(
  manifestPath,
  await format(JSON.stringify(manifest), { ...prettierConfig, filepath: manifestPath }),
  'utf8',
);

if (gateFailures.length > 0) {
  throw new Error(
    `M5 responsive visual gate failed for ${String(gateFailures.length)} capture(s). See ${manifestPath}.\n${gateFailures.join('\n')}`,
  );
}

console.log(
  `Captured and checked ${String(results.length)} M5 responsive views in ${outputDirectory}.`,
);
