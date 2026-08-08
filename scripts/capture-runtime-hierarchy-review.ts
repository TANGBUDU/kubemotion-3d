import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m3');
const goldenLesson = 'container-restart-vs-pod-replacement';
const apiAPodId = 'api-object:namespaced:shop:Pod:api-a-old';

type Gate = 'desktop-placement' | 'desktop-pending' | 'known-m5-risk';

interface Capture {
  readonly id: string;
  readonly file: string;
  readonly viewport: ViewportSize;
  readonly route: 'explore-placement' | 'golden-pending-step';
  readonly gate: Gate;
  readonly closeUp?: boolean;
}

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SceneDiagnostics {
  readonly entityHandles: number;
  readonly activeAnimations: number;
  readonly retainedExitHandles: number;
  readonly visibleNodes: number;
  readonly nodeBays: number;
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
  readonly [key: string]: number;
}

const captures: readonly Capture[] = [
  {
    id: 'placement-runtime-desktop-compact',
    file: 'm3-placement-runtime-1280x720.png',
    viewport: { width: 1280, height: 720 },
    route: 'explore-placement',
    gate: 'desktop-placement',
  },
  {
    id: 'pod-container-close-desktop-wide',
    file: 'm3-pod-container-close-1440x900.png',
    viewport: { width: 1440, height: 900 },
    route: 'explore-placement',
    gate: 'desktop-placement',
    closeUp: true,
  },
  {
    id: 'pending-outside-node-desktop-compact',
    file: 'm3-pending-outside-node-1280x720.png',
    viewport: { width: 1280, height: 720 },
    route: 'golden-pending-step',
    gate: 'desktop-pending',
  },
  {
    id: 'pod-container-mobile-risk-record',
    file: 'm3-pod-container-390x844.png',
    viewport: { width: 390, height: 844 },
    route: 'explore-placement',
    gate: 'known-m5-risk',
  },
];

const placementExpected = {
  visibleNodes: 3,
  nodeBays: 12,
  scheduledPods: 3,
  scheduledPodsOutsideBays: 0,
  duplicateBayAssignments: 0,
  podPairOverlaps: 0,
  podSystemModuleOverlaps: 0,
  pendingPodsInsideNodes: 0,
  nodeHandles: 3,
  podHandles: 3,
  mountedKubelets: 3,
  mountedContainerRuntimes: 3,
  orphanKubelets: 0,
  orphanContainerRuntimes: 0,
  containedContainers: 3,
  containersOutsidePods: 0,
} as const;

const pendingExpected = {
  pendingPods: 1,
  pendingPodsInsideNodes: 0,
  scheduledPodsOutsideBays: 0,
  duplicateBayAssignments: 0,
  podPairOverlaps: 0,
  podSystemModuleOverlaps: 0,
} as const;

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
        diagnostics.activeAnimations === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(220);
}

async function inspect(page: Page) {
  const labels = page.locator('.scene-viewport .scene-label[data-entity-id]:visible');
  const boxes = (
    await Promise.all(
      Array.from({ length: await labels.count() }, (_, index) => labels.nth(index).boundingBox()),
    )
  ).filter((box): box is Rectangle => box !== null);

  let maximumLabelOverlap = 0;
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      maximumLabelOverlap = Math.max(
        maximumLabelOverlap,
        overlapRatio(boxes[left] as Rectangle, boxes[right] as Rectangle),
      );
    }
  }

  const stage = await page.getByTestId('scene-viewport').boundingBox();
  const labelsOutsideStage = stage
    ? boxes.filter(
        (box) =>
          box.x < stage.x ||
          box.y < stage.y ||
          box.x + box.width > stage.x + stage.width ||
          box.y + box.height > stage.y + stage.height,
      ).length
    : boxes.length;
  const diagnostics = await page.evaluate(() =>
    (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');

  return {
    entityLabels: boxes.length,
    layoutLabels: await page.locator('.scene-layout-label:visible').count(),
    maximumLabelOverlap,
    labelsOutsideStage,
    diagnostics,
  };
}

function assertExpected(
  capture: Capture,
  diagnostics: SceneDiagnostics,
  expected: Readonly<Record<string, number>>,
): void {
  const failures = Object.entries(expected).flatMap(([key, value]) =>
    diagnostics[key] === value ? [] : [`${key}=${diagnostics[key]} (expected ${value})`],
  );
  if (failures.length > 0) {
    throw new Error(`${capture.id}: runtime hierarchy gate failed: ${failures.join('; ')}`);
  }
}

function assertDesktopLabels(
  capture: Capture,
  inspection: Awaited<ReturnType<typeof inspect>>,
): void {
  const failures: string[] = [];
  if (inspection.maximumLabelOverlap > 0.12) {
    failures.push(
      `maximumLabelOverlap=${inspection.maximumLabelOverlap.toFixed(4)} (expected <= 0.12)`,
    );
  }
  if (inspection.labelsOutsideStage !== 0) {
    failures.push(`labelsOutsideStage=${inspection.labelsOutsideStage} (expected 0)`);
  }
  if (failures.length > 0) {
    throw new Error(`${capture.id}: desktop label gate failed: ${failures.join('; ')}`);
  }
}

async function openCapture(page: Page, capture: Capture): Promise<void> {
  if (capture.route === 'golden-pending-step') {
    await page.goto(`${baseUrl}/#/learn/${goldenLesson}/6`);
    await waitForSettledScene(page);
    return;
  }

  await page.goto(`${baseUrl}/#/explore`);
  await waitForSettledScene(page);
  await page.locator('#explore-view-tab-placement').click();
  await waitForSettledScene(page);

  if (!capture.closeUp) return;
  const objectPicker = page.getByRole('combobox', { name: 'Inspect an object' });
  await objectPicker.selectOption(apiAPodId);
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${capture.id}: canvas has no measurable bounding box`);
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.56);
  await page.mouse.wheel(0, -680);
  await page.waitForTimeout(260);
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
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await openCapture(page, capture);

    const inspection = await inspect(page);
    if (capture.gate === 'desktop-placement') {
      assertExpected(capture, inspection.diagnostics, placementExpected);
      assertDesktopLabels(capture, inspection);
    } else if (capture.gate === 'desktop-pending') {
      assertExpected(capture, inspection.diagnostics, pendingExpected);
      assertDesktopLabels(capture, inspection);
    }

    await page.screenshot({
      path: path.join(outputDirectory, capture.file),
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });
    results.push({
      ...capture,
      status: capture.gate === 'known-m5-risk' ? 'recorded' : 'pass',
      inspection,
      acceptance: {
        runtimeHierarchyGate:
          capture.gate === 'desktop-placement'
            ? placementExpected
            : capture.gate === 'desktop-pending'
              ? pendingExpected
              : 'Not enforced: responsive teaching composition is owned by M5.',
        desktopLabelGate:
          capture.gate === 'known-m5-risk'
            ? 'Not enforced: evidence-only M5 risk record.'
            : { maximumLabelOverlap: 0.12, labelsOutsideStage: 0 },
        interaction:
          capture.closeUp === true
            ? `Selected ${apiAPodId}, closed the inspector, then zoomed the canvas with page.mouse.wheel.`
            : undefined,
      },
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, 'm3-runtime-hierarchy-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      milestone: 3,
      baseUrl,
      desktopPlacementGate: placementExpected,
      desktopPendingGate: pendingExpected,
      desktopLabelGate: { maximumLabelOverlap: 0.12, labelsOutsideStage: 0 },
      mobilePolicy:
        'The 390x844 capture records the known M5 responsive-layout risk and does not fail M3.',
      captures: results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Captured and checked ${results.length} M3 runtime-hierarchy views in ${outputDirectory}.`,
);
