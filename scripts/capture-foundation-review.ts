import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';
import type { ViewMode } from '../src/course/types';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m2');

interface Capture {
  readonly id: string;
  readonly file: string;
  readonly view: Extract<ViewMode, 'overview' | 'control-flow'>;
  readonly viewport: ViewportSize;
  readonly gate: 'desktop-m2' | 'known-m5-risk';
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
  readonly semanticIslands: number;
  readonly foundationMeshes: number;
  readonly dominantGridMarks: number;
  readonly [key: string]: number;
}

const captures: readonly Capture[] = [
  {
    id: 'overview-desktop-wide',
    file: 'm2-overview-foundation-1440x900.png',
    view: 'overview',
    viewport: { width: 1440, height: 900 },
    gate: 'desktop-m2',
  },
  {
    id: 'overview-desktop-compact',
    file: 'm2-overview-foundation-1280x720.png',
    view: 'overview',
    viewport: { width: 1280, height: 720 },
    gate: 'desktop-m2',
  },
  {
    id: 'overview-mobile-risk-record',
    file: 'm2-overview-foundation-390x844.png',
    view: 'overview',
    viewport: { width: 390, height: 844 },
    gate: 'known-m5-risk',
  },
  {
    id: 'control-flow-desktop-compact',
    file: 'm2-control-flow-foundation-1280x720.png',
    view: 'control-flow',
    viewport: { width: 1280, height: 720 },
    gate: 'desktop-m2',
  },
];

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
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics };
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
  const entityLabels = page.locator('.scene-viewport .scene-label[data-entity-id]:visible');
  const labelBoxes = (
    await Promise.all(
      Array.from({ length: await entityLabels.count() }, (_, index) =>
        entityLabels.nth(index).boundingBox(),
      ),
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

  const stage = await page.getByTestId('scene-viewport').boundingBox();
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
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');

  return {
    entityLabels: labelBoxes.length,
    layoutLabels: await page.locator('.scene-layout-label:visible').count(),
    relationLabels: await page.locator('.scene-relation-label:visible').count(),
    routeLabels: await page.locator('.scene-route-label:visible').count(),
    maximumLabelOverlap,
    labelsOutsideStage,
    diagnostics,
  };
}

function assertDesktopGate(
  capture: Capture,
  inspection: Awaited<ReturnType<typeof inspect>>,
): void {
  const failures: string[] = [];
  if (inspection.diagnostics.foundationMeshes < 3) {
    failures.push(
      `foundationMeshes=${inspection.diagnostics.foundationMeshes} (expected at least 3)`,
    );
  }
  if (capture.view === 'overview' && inspection.diagnostics.semanticIslands !== 3) {
    failures.push(
      `semanticIslands=${inspection.diagnostics.semanticIslands} (expected exactly 3 for Overview)`,
    );
  }
  if (inspection.diagnostics.dominantGridMarks !== 0) {
    failures.push(
      `dominantGridMarks=${inspection.diagnostics.dominantGridMarks} (expected exactly 0)`,
    );
  }
  if (inspection.maximumLabelOverlap > 0.12) {
    failures.push(
      `maximumLabelOverlap=${inspection.maximumLabelOverlap.toFixed(4)} (expected <= 0.12)`,
    );
  }
  if (inspection.labelsOutsideStage !== 0) {
    failures.push(`labelsOutsideStage=${inspection.labelsOutsideStage} (expected 0)`);
  }
  if (failures.length > 0) {
    throw new Error(`${capture.id}: M2 desktop foundation gate failed: ${failures.join('; ')}`);
  }
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
    await page.goto(`${baseUrl}/#/explore`);
    await waitForSettledScene(page);
    if (capture.view !== 'overview') {
      await page.locator(`#explore-view-tab-${capture.view}`).click();
      await waitForSettledScene(page);
    }

    const inspection = await inspect(page);
    if (capture.gate === 'desktop-m2') assertDesktopGate(capture, inspection);

    await page.screenshot({
      path: path.join(outputDirectory, capture.file),
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });
    results.push({
      ...capture,
      status: capture.gate === 'desktop-m2' ? 'pass' : 'recorded',
      inspection,
      acceptance: {
        clusterBoundaryClear: inspection.diagnostics.foundationMeshes >= 3,
        semanticFoundationClear:
          capture.view !== 'overview' || inspection.diagnostics.semanticIslands === 3,
        dominantInfiniteGridAbsent: inspection.diagnostics.dominantGridMarks === 0,
        note:
          capture.gate === 'known-m5-risk'
            ? 'Mobile composition is evidence-only for M2; responsive teaching layout is owned by M5.'
            : 'Automated M2 desktop foundation gate passed.',
      },
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, 'm2-foundation-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      milestone: 2,
      baseUrl,
      desktopGate: {
        minimumFoundationMeshes: 3,
        overviewSemanticIslands: 3,
        dominantGridMarks: 0,
        maximumLabelOverlap: 0.12,
        labelsOutsideStage: 0,
      },
      mobilePolicy:
        'The 390x844 capture records the known M5 responsive-layout risk and does not fail M2.',
      captures: results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Captured and checked ${results.length} M2 foundation views in ${outputDirectory}.`);
