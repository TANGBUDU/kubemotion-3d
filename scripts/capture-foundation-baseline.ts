import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';
import { parse } from 'yaml';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/before-after');
const desktop = { width: 1440, height: 900 } as const;

interface LocalizedText {
  readonly en: string;
  readonly ja: string;
  readonly 'zh-CN': string;
}

interface ManifestEntry {
  readonly id: string;
  readonly status: 'available' | 'planned';
  readonly title: LocalizedText;
}

interface CourseManifestSource {
  readonly lessonOrder: readonly string[];
  readonly lessons: readonly ManifestEntry[];
}

interface AuthoredLessonSource {
  readonly steps: readonly {
    readonly viewPatch?: {
      readonly activeRoutes?: readonly { readonly id: string }[];
    };
    readonly transition?: {
      readonly cues?: readonly { readonly type: string; readonly routeId?: string }[];
    };
  }[];
}

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface BaselineCapture {
  readonly id: string;
  readonly url: string;
  readonly file: string;
  readonly viewport: ViewportSize;
  readonly lessonId?: string;
  readonly step?: number;
  readonly purpose: 'explore-overview' | 'lesson-entry' | 'settled-route';
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

async function readYaml<T>(relativePath: string): Promise<T> {
  return parse(await readFile(path.resolve(relativePath), 'utf8')) as T;
}

async function waitForScene(page: Page): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
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

async function inspectScene(page: Page) {
  const entityLabels = page.locator('.scene-viewport .scene-label[data-entity-id]:visible');
  const labelCount = await entityLabels.count();
  const labelBoxes = (
    await Promise.all(
      Array.from({ length: labelCount }, (_, index) => entityLabels.nth(index).boundingBox()),
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
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => Readonly<Record<string, number>> };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');
  return {
    entityLabels: labelCount,
    layoutLabels: await page.locator('.scene-layout-label:visible').count(),
    routeLabels: await page.locator('.scene-route-label:visible').allTextContents(),
    maximumLabelOverlap,
    labelsOutsideStage,
    teachingTextVisible: await page
      .getByTestId('teaching-what-changed')
      .isVisible()
      .catch(() => false),
    diagnostics,
  };
}

const manifest = await readYaml<CourseManifestSource>(
  'content/courses/kubernetes-foundations/course.yaml',
);
const entryById = new Map(manifest.lessons.map((entry) => [entry.id, entry]));
const availableEntries = manifest.lessonOrder.flatMap((lessonId) => {
  const entry = entryById.get(lessonId);
  return entry?.status === 'available' ? [entry] : [];
});

const captures: BaselineCapture[] = [
  {
    id: 'explore-overview',
    url: '/#/explore',
    file: 'branch-before-explore-overview-1440x900.png',
    viewport: desktop,
    purpose: 'explore-overview',
  },
];

for (const entry of availableEntries) {
  captures.push({
    id: `${entry.id}-entry`,
    url: `/#/learn/${entry.id}/0`,
    file: `branch-before-${entry.id}-step-00-1440x900.png`,
    viewport: desktop,
    lessonId: entry.id,
    step: 0,
    purpose: 'lesson-entry',
  });
  const lesson = await readYaml<AuthoredLessonSource>(
    `content/courses/kubernetes-foundations/lessons/${entry.id}.yaml`,
  );
  const routeStep = lesson.steps.findIndex((step) => {
    const routeIds = new Set((step.viewPatch?.activeRoutes ?? []).map((route) => route.id));
    return (step.transition?.cues ?? []).some(
      (cue) =>
        (cue.type === 'data-packet' || cue.type === 'dns-query' || cue.type === 'api-request') &&
        cue.routeId !== undefined &&
        routeIds.has(cue.routeId),
    );
  });
  if (routeStep >= 0) {
    captures.push({
      id: `${entry.id}-settled-route`,
      url: `/#/learn/${entry.id}/${routeStep}`,
      file: `branch-before-${entry.id}-route-step-${String(routeStep).padStart(2, '0')}-1440x900.png`,
      viewport: desktop,
      lessonId: entry.id,
      step: routeStep,
      purpose: 'settled-route',
    });
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
      reducedMotion: 'no-preference',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${capture.url}`);
    await waitForScene(page);
    const inspection = await inspectScene(page);
    await page.screenshot({
      path: path.join(outputDirectory, capture.file),
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
    results.push({ ...capture, inspection });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, 'foundation-baseline-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baselineCommit:
        process.env.KUBEMOTION_BASELINE_COMMIT ?? 'bdcc5f92e61ff3e9bcee2c5048a0dbc87c19e0c4',
      baseUrl,
      availableLessonCount: availableEntries.length,
      plannedLessonCount: manifest.lessons.filter((entry) => entry.status === 'planned').length,
      availableLessons: availableEntries.map((entry) => ({ id: entry.id, title: entry.title })),
      captures: results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Captured foundation baseline for Explore and ${availableEntries.length} available lessons (${captures.length} screenshots).`,
);
