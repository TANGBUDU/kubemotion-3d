import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import { waitForSceneIdle } from './helpers';

const evidenceDirectory = path.resolve('docs/review/evidence/batch02');
const diagnosticsFile = path.join(evidenceDirectory, 'batch02-composition-diagnostics.json');

interface CaptureCase {
  readonly id: string;
  readonly file: string;
  readonly lessonId: string;
  readonly stepIndex: number;
  readonly title: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly minimumWidthRatio: number;
  readonly minimumHeightRatio?: number;
}

interface CaptureResult {
  readonly id: string;
  readonly file: string;
  readonly lessonId: string;
  readonly stepIndex: number;
  readonly viewport: CaptureCase['viewport'];
  readonly diagnostics: SceneDiagnostics;
}

const captures: readonly CaptureCase[] = [
  {
    id: 'overview-desktop',
    file: 'batch02-overview-desktop.png',
    lessonId: 'cluster-overview',
    stepIndex: 4,
    title: 'Read the cluster from foundation to workload',
    viewport: { width: 1280, height: 720 },
    minimumWidthRatio: 0.55,
    minimumHeightRatio: 0.42,
  },
  {
    id: 'node-pod-desktop',
    file: 'batch02-node-pod-desktop.png',
    lessonId: 'pod-and-placement',
    stepIndex: 4,
    title: 'The Node bay preserves Pod and Container containment',
    viewport: { width: 1280, height: 720 },
    minimumWidthRatio: 0.42,
    minimumHeightRatio: 0.4,
  },
  {
    id: 'replicaset-desktop',
    file: 'batch02-replicaset-desktop.png',
    lessonId: 'deployment-replicaset-and-pods',
    stepIndex: 3,
    title: 'ReplicaSet owns replaceable Pod slots',
    viewport: { width: 1280, height: 720 },
    minimumWidthRatio: 0.5,
  },
  {
    id: 'service-desktop',
    file: 'batch02-service-desktop.png',
    lessonId: 'service-routes-to-pods',
    stepIndex: 2,
    title: 'EndpointSlice lists eligible backends',
    viewport: { width: 1280, height: 720 },
    minimumWidthRatio: 0.5,
  },
  {
    id: 'node-pod-mobile',
    file: 'batch02-node-pod-mobile.png',
    lessonId: 'pod-and-placement',
    stepIndex: 4,
    title: 'The Node bay preserves Pod and Container containment',
    viewport: { width: 390, height: 844 },
    minimumWidthRatio: 0.55,
  },
] as const;

async function captureCase(page: Page, capture: CaptureCase): Promise<CaptureResult> {
  await page.setViewportSize(capture.viewport);
  await page.goto(`/#/learn/${capture.lessonId}/${capture.stepIndex}`);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(capture.title);
  await waitForSceneIdle(page);

  const diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  if (!diagnostics) throw new Error(`Scene diagnostics were unavailable for ${capture.id}`);

  await page.screenshot({
    path: path.join(evidenceDirectory, capture.file),
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    scale: 'css',
  });

  return {
    id: capture.id,
    file: capture.file,
    lessonId: capture.lessonId,
    stepIndex: capture.stepIndex,
    viewport: capture.viewport,
    diagnostics,
  };
}

test('Batch 02 teaching subjects fill the safe viewport without clipping', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280-chromium',
    'The Batch 02 evidence gate runs in one desktop project and sets its mobile viewport directly.',
  );
  test.setTimeout(120_000);

  await mkdir(evidenceDirectory, { recursive: true });
  await Promise.all([
    ...captures.map((capture) => rm(path.join(evidenceDirectory, capture.file), { force: true })),
    rm(diagnosticsFile, { force: true }),
  ]);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const results: CaptureResult[] = [];
  for (const capture of captures) results.push(await captureCase(page, capture));

  await writeFile(
    diagnosticsFile,
    `${JSON.stringify(
      {
        baseline: 'bbe90cd8f5fe1a90801f79448db572065b3f9165',
        branch: 'rebuild/world-state-engine',
        captures: results,
      },
      undefined,
      2,
    )}\n`,
    'utf8',
  );

  for (const [index, result] of results.entries()) {
    const capture = captures[index];
    if (!capture) throw new Error(`Missing capture contract for ${result.id}`);
    expect(result.diagnostics.focusedEntitiesOutsideSafeRect, result.id).toBe(0);
    expect(result.diagnostics.routesOutsideSafeRect, result.id).toBe(0);
    expect(result.diagnostics.arrowheadsOutsideSafeRect, result.id).toBe(0);
    expect(result.diagnostics.sceneBoundsOutsideContentRect, result.id).toBe(0);
    expect(result.diagnostics.subjectScreenWidthRatio, result.id).toBeGreaterThanOrEqual(
      capture.minimumWidthRatio,
    );
    if (capture.minimumHeightRatio !== undefined) {
      expect(result.diagnostics.subjectScreenHeightRatio, result.id).toBeGreaterThanOrEqual(
        capture.minimumHeightRatio,
      );
    }
  }
});
