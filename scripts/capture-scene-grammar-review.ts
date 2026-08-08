import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import type { ViewMode } from '../src/course/types';
import { sceneGrammarFor } from '../src/renderer/scene-grammar';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/before-after');
const viewport = { width: 1440, height: 900 } as const;
const views: readonly ViewMode[] = [
  'overview',
  'logical',
  'placement',
  'control-flow',
  'traffic',
  'storage',
];

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

async function waitForSettledScene(page: Page): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: {
            getSceneDiagnostics: () => {
              activeAnimations: number;
              retainedExitHandles: number;
            };
          };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
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
  const labelLocator = page.locator('.scene-viewport .scene-label[data-entity-id]:visible');
  const boxes = (
    await Promise.all(
      Array.from({ length: await labelLocator.count() }, (_, index) =>
        labelLocator.nth(index).boundingBox(),
      ),
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
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => Readonly<Record<string, number>> };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');
  return {
    entityLabels: boxes.length,
    layoutLabels: await page.locator('.scene-layout-label:visible').count(),
    relationLabels: await page.locator('.scene-relation-label:visible').count(),
    routeLabels: await page.locator('.scene-route-label:visible').count(),
    maximumLabelOverlap,
    labelsOutsideStage,
    diagnostics,
  };
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const results: Array<Record<string, unknown>> = [];

try {
  for (const view of views) {
    const context = await browser.newContext({
      viewport,
      colorScheme: 'dark',
      locale: 'en-US',
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/#/explore`);
    await waitForSettledScene(page);
    if (view !== 'overview') {
      await page.locator(`#explore-view-tab-${view}`).click();
      await waitForSettledScene(page);
    }
    const inspection = await inspect(page);
    const budget = sceneGrammarFor(view).budgets.desktop;
    const entityHandles = inspection.diagnostics.entityHandles ?? Number.POSITIVE_INFINITY;
    if (entityHandles > budget.maxPrimaryEntities + budget.maxSecondaryEntities) {
      throw new Error(`${view}: ${entityHandles} visible entities exceed its desktop budget`);
    }
    if (inspection.entityLabels > budget.maxEntityLabels) {
      throw new Error(`${view}: ${inspection.entityLabels} entity labels exceed its budget`);
    }
    if (inspection.labelsOutsideStage > 0 || inspection.maximumLabelOverlap > 0.12) {
      throw new Error(`${view}: label placement gate failed`);
    }
    const file = `m1-${view}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, file),
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
    results.push({ view, file, viewport, budget, inspection });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, 'm1-scene-grammar-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      milestone: 1,
      baseUrl,
      captures: results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Captured and checked ${results.length} M1 scene-grammar views.`);
