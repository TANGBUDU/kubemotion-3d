import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/screenshots');

interface Capture {
  readonly name: string;
  readonly lessonId: string;
  readonly step: number;
  readonly viewport: ViewportSize;
  readonly reducedMotion?: boolean;
}

interface FocusedCapture {
  readonly name: string;
  readonly lessonId: string;
  readonly step: number;
  readonly viewport: ViewportSize;
  readonly selector: string;
}

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function overlapRatio(left: Rectangle, right: Rectangle): number {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea <= 0 ? 0 : (width * height) / smallerArea;
}

async function inspectPage(page: Page) {
  const labelLocator = page.locator(
    '.scene-canvas:not(.is-visually-suspended) .scene-label:not(.scene-layout-label):not(.scene-route-label):visible',
  );
  const labelCount = await labelLocator.count();
  const labelBoxes = (
    await Promise.all(
      Array.from({ length: labelCount }, (_, index) => labelLocator.nth(index).boundingBox()),
    )
  ).filter((box): box is Rectangle => box !== null);
  let maximumLabelOverlap = 0;
  for (let left = 0; left < labelBoxes.length; left += 1) {
    for (let right = left + 1; right < labelBoxes.length; right += 1) {
      maximumLabelOverlap = Math.max(
        maximumLabelOverlap,
        overlapRatio(labelBoxes[left] as Rectangle, labelBoxes[right] as Rectangle),
      );
    }
  }
  const stage = await page.locator('.scene-canvas').boundingBox();
  const labelsOutsideStage = stage
    ? labelBoxes.filter(
        (box) =>
          box.x < stage.x ||
          box.y < stage.y ||
          box.x + box.width > stage.x + stage.width ||
          box.y + box.height > stage.y + stage.height,
      ).length
    : labelBoxes.length;
  const diagnostics = await page.evaluate(() =>
    (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => Readonly<Record<string, number>> };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  return {
    labelCount,
    maximumLabelOverlap,
    labelsOutsideStage,
    routeLabels: await page.locator('.scene-route-label:visible').allTextContents(),
    calloutCount: await page.locator('.scene-callout:visible').count(),
    teachingTextVisible: await page.getByTestId('teaching-what-changed').isVisible(),
    visibleComparisonRows: await page
      .locator('[data-testid="comparison-panel"] dt:visible')
      .count(),
    evidenceText: await page.getByTestId('evidence-panel').innerText(),
    diagnostics,
  };
}

const golden = 'container-restart-vs-pod-replacement';
const service = 'service-routes-to-pods';
const desktop1440 = { width: 1440, height: 900 } as const;
const desktop1280 = { width: 1280, height: 720 } as const;
const mobile390 = { width: 390, height: 844 } as const;

const captures: readonly Capture[] = [
  ...Array.from({ length: 10 }, (_, step) => ({
    name: `golden-step-${String(step).padStart(2, '0')}-1440x900`,
    lessonId: golden,
    step,
    viewport: desktop1440,
  })),
  ...Array.from({ length: 10 }, (_, step) => ({
    name: `golden-step-${String(step).padStart(2, '0')}-1280x720`,
    lessonId: golden,
    step,
    viewport: desktop1280,
  })),
  ...[0, 2, 3, 6, 8, 9].map((step) => ({
    name: `golden-step-${String(step).padStart(2, '0')}-390x844`,
    lessonId: golden,
    step,
    viewport: mobile390,
  })),
  ...[0, 3, 4, 5].map((step) => ({
    name: `service-step-${String(step).padStart(2, '0')}-1440x900`,
    lessonId: service,
    step,
    viewport: desktop1440,
  })),
  ...[3, 4, 5].map((step) => ({
    name: `service-step-${String(step).padStart(2, '0')}-1280x720`,
    lessonId: service,
    step,
    viewport: desktop1280,
  })),
  ...[3, 5].map((step) => ({
    name: `service-step-${String(step).padStart(2, '0')}-390x844`,
    lessonId: service,
    step,
    viewport: mobile390,
  })),
  {
    name: 'golden-step-03-local-restart-reduced-motion-1280x720',
    lessonId: golden,
    step: 3,
    viewport: desktop1280,
    reducedMotion: true,
  },
  {
    name: 'golden-step-08-reduced-motion-1280x720',
    lessonId: golden,
    step: 8,
    viewport: desktop1280,
    reducedMotion: true,
  },
  {
    name: 'service-step-05-request-b-reduced-motion-1280x720',
    lessonId: service,
    step: 5,
    viewport: desktop1280,
    reducedMotion: true,
  },
];

const focusedCaptures: readonly FocusedCapture[] = [
  ...[2, 3].map((step) => ({
    name: `evidence-golden-step-${String(step).padStart(2, '0')}-1280x720`,
    lessonId: golden,
    step,
    viewport: desktop1280,
    selector: '[data-testid="evidence-panel"]',
  })),
  ...[4, 5].map((step) => ({
    name: `evidence-service-step-${String(step).padStart(2, '0')}-1280x720`,
    lessonId: service,
    step,
    viewport: desktop1280,
    selector: '[data-testid="evidence-panel"]',
  })),
  {
    name: 'comparison-golden-step-09-1280x720',
    lessonId: golden,
    step: 9,
    viewport: desktop1280,
    selector: '[data-testid="comparison-panel"]',
  },
];

async function waitForScene(page: Page): Promise<void> {
  await page.locator('.lesson-shell').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: {
            getSceneDiagnostics: () => {
              entityHandles: number;
              activeAnimations: number;
              retainedExitHandles: number;
            };
          };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
        diagnostics.entityHandles > 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(180);
}

async function revealMobileEvidence(page: Page, capture: Capture): Promise<void> {
  if (capture.viewport.width > 720) return;
  const goldenEvidenceStep = capture.lessonId === golden && [2, 3, 6, 8].includes(capture.step);
  const serviceEvidenceStep = capture.lessonId === service && [3, 5].includes(capture.step);
  if (!goldenEvidenceStep && !serviceEvidenceStep) return;
  await page.getByTestId('evidence-panel').scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const results: Array<Record<string, unknown>> = [];

try {
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale: 'en-US',
      reducedMotion: capture.reducedMotion ? 'reduce' : 'no-preference',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/#/learn/${capture.lessonId}/${capture.step}`);
    await waitForScene(page);
    await revealMobileEvidence(page, capture);
    const inspection = await inspectPage(page);
    await page.screenshot({
      path: path.join(outputDirectory, `${capture.name}.png`),
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
    results.push({
      kind: 'full-page',
      file: `${capture.name}.png`,
      lessonId: capture.lessonId,
      step: capture.step,
      viewport: capture.viewport,
      reducedMotion: capture.reducedMotion ?? false,
      inspection,
    });
    await context.close();
  }

  for (const capture of focusedCaptures) {
    const context = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale: 'en-US',
      reducedMotion: 'no-preference',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/#/learn/${capture.lessonId}/${capture.step}`);
    await waitForScene(page);
    const element = page.locator(capture.selector);
    await element.waitFor({ state: 'visible' });
    await element.screenshot({
      path: path.join(outputDirectory, `${capture.name}.png`),
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
    results.push({
      kind: 'focused-element',
      file: `${capture.name}.png`,
      lessonId: capture.lessonId,
      step: capture.step,
      viewport: capture.viewport,
      selector: capture.selector,
      inspection: await inspectPage(page),
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      captures: results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Captured ${captures.length} full-page and ${focusedCaptures.length} focused visual-acceptance screenshots in ${outputDirectory}`,
);
