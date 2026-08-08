import { expect, test, type Page } from '@playwright/test';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import type { SceneControllerLifecycleDiagnostics } from '../../src/test-support/debugBridge';
import {
  GOLDEN_LESSON,
  SERVICE_LESSON,
  SERVICE_STEP_TITLES,
  STEP_TITLES,
  gotoGoldenStep,
  gotoServiceStep,
  waitForSceneIdle,
} from './helpers';

async function sceneControllerLifecycle(page: Page): Promise<SceneControllerLifecycleDiagnostics> {
  const lifecycle = await page.evaluate(() =>
    window.__KUBEMOTION_TEST__?.getSceneControllerLifecycle(),
  );
  if (!lifecycle) throw new Error('Scene controller lifecycle diagnostics are unavailable.');
  return lifecycle;
}

const verifiedLessonCycle = [
  { lessonId: 'why-kubernetes-exists', stepIndex: 0 },
  { lessonId: 'cluster-overview', stepIndex: 0 },
  { lessonId: 'pod-and-container', stepIndex: 0 },
  { lessonId: 'pod-and-placement', stepIndex: 0 },
  { lessonId: 'deployment-replicaset-and-pods', stepIndex: 0 },
  { lessonId: 'manifest-to-running-pod', stepIndex: 1 },
  { lessonId: 'pending-and-scheduling', stepIndex: 1 },
  { lessonId: GOLDEN_LESSON, stepIndex: 7 },
  { lessonId: 'labels-and-selectors', stepIndex: 0 },
  { lessonId: SERVICE_LESSON, stepIndex: 3 },
  { lessonId: 'dns-and-service-discovery', stepIndex: 1 },
  { lessonId: 'probes-and-rolling-update', stepIndex: 4 },
] as const;

test('20 navigation/replay/locale/selection/reset cycles keep resources bounded', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop renderer stress gate');
  test.setTimeout(180_000);

  for (let stepIndex = 0; stepIndex < STEP_TITLES.length; stepIndex += 1) {
    await gotoGoldenStep(page, stepIndex);
    await page
      .locator('.lesson-header')
      .getByRole('button', { name: /Replay|Restart lesson/i })
      .click();
    await waitForSceneIdle(page);
  }
  for (let stepIndex = 0; stepIndex < SERVICE_STEP_TITLES.length; stepIndex += 1) {
    await gotoServiceStep(page, stepIndex);
    await page
      .locator('.lesson-header')
      .getByRole('button', { name: /Replay|Restart lesson/i })
      .click();
    await waitForSceneIdle(page);
  }
  for (const { lessonId, stepIndex } of verifiedLessonCycle) {
    if (lessonId === GOLDEN_LESSON || lessonId === SERVICE_LESSON) continue;
    await page.goto(`/#/learn/${lessonId}/${stepIndex}`);
    await expect(page.getByTestId('teaching-step-heading')).toBeVisible();
    await page
      .locator('.lesson-header')
      .getByRole('button', { name: /Replay|Restart lesson/i })
      .click();
    await waitForSceneIdle(page);
  }
  const baselineStepIndex = 7;
  const baselineTitle = STEP_TITLES[baselineStepIndex];
  if (!baselineTitle) throw new Error('Golden lesson has no route-heavy baseline step.');
  await gotoGoldenStep(page, baselineStepIndex);
  await page.evaluate(() => window.__KUBEMOTION_TEST__?.selectEntity());
  const baseline = await page.evaluate(
    () => window.__KUBEMOTION_TEST__?.getSceneDiagnostics() as SceneDiagnostics | undefined,
  );
  expect(baseline).toBeDefined();
  expect(baseline?.renderTargets).toBeGreaterThan(0);
  expect(baseline?.eventListeners).toBeGreaterThan(0);
  expect(baseline?.routeHandles).toBeGreaterThan(0);
  expect(baseline?.arrowheads).toBeGreaterThan(0);
  expect(baseline?.routeMarkers).toBeGreaterThan(0);
  const baselineLifecycle = await sceneControllerLifecycle(page);
  expect(baselineLifecycle.active).toBe(1);
  expect(baselineLifecycle.created).toBe(baselineLifecycle.destroyed + baselineLifecycle.active);
  expect(baselineLifecycle.destroyedWithActiveListeners).toBe(0);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.locator('.lesson-language select').selectOption('en');
    const target = verifiedLessonCycle[cycle % verifiedLessonCycle.length];
    if (!target) throw new Error(`Missing verified lesson target for cycle ${cycle}`);
    const { lessonId, stepIndex } = target;
    await page.evaluate(
      ({ lessonId, index }) => {
        location.hash = `#/learn/${lessonId}/${index}`;
      },
      { lessonId, index: stepIndex },
    );
    await expect(page.getByTestId('teaching-step-heading')).toBeVisible();
    if (lessonId === GOLDEN_LESSON) {
      await page.evaluate(() =>
        window.__KUBEMOTION_TEST__?.selectEntity('api-object:namespaced:shop:ReplicaSet:api-rs'),
      );
    }
    await page
      .locator('.lesson-language select')
      .selectOption(cycle % 3 === 0 ? 'ja' : cycle % 3 === 1 ? 'zh-CN' : 'en');
    await page
      .locator('.lesson-header')
      .getByRole('button', { name: /Replay|Restart lesson|再生|最初から|重播|重新开始/i })
      .click();
    await page.getByRole('button', { name: /Reset camera|カメラをリセット|重置相机/i }).click();
  }

  await page.locator('.lesson-language select').selectOption('en');
  await page.evaluate(
    ({ lessonId, stepIndex }) => {
      location.hash = `#/learn/${lessonId}/${stepIndex}`;
    },
    { lessonId: GOLDEN_LESSON, stepIndex: baselineStepIndex },
  );
  await expect(page.getByRole('heading', { name: baselineTitle })).toBeVisible();
  await page.evaluate(() => window.__KUBEMOTION_TEST__?.selectEntity());
  await page.getByRole('button', { name: /Replay/i }).click();
  await waitForSceneIdle(page);
  const after = await page.evaluate(
    () => window.__KUBEMOTION_TEST__?.getSceneDiagnostics() as SceneDiagnostics | undefined,
  );
  expect(after).toBeDefined();
  expect(after?.activeAnimations).toBe(0);
  expect(after?.retainedExitHandles).toBe(0);
  expect(after?.entityHandles).toBe(baseline?.entityHandles);
  expect(after?.relationHandles).toBe(baseline?.relationHandles);
  expect(after?.labels).toBeLessThanOrEqual((baseline?.labels ?? 0) + 1);
  expect(after?.callouts).toBeLessThanOrEqual((baseline?.callouts ?? 0) + 1);
  expect.soft(after?.geometries).toBeLessThanOrEqual((baseline?.geometries ?? 0) + 2);
  expect.soft(after?.textures).toBeLessThanOrEqual((baseline?.textures ?? 0) + 2);
  expect.soft(after?.programs).toBeLessThanOrEqual((baseline?.programs ?? 0) + 2);
  expect.soft(after?.drawCalls).toBeLessThanOrEqual((baseline?.drawCalls ?? 0) + 2);
  expect.soft(after?.pooledTokens).toBeLessThanOrEqual((baseline?.pooledTokens ?? 0) + 2);
  expect(after?.routeHandles).toBe(baseline?.routeHandles);
  expect(after?.wideLineGeometries).toBe(after?.routeHandles);
  expect(after?.wideLineMaterials).toBe(after?.routeHandles);
  expect.soft(after?.arrowheads).toBeLessThanOrEqual((baseline?.arrowheads ?? 0) + 2);
  expect.soft(after?.flowTokens).toBeLessThanOrEqual((baseline?.flowTokens ?? 0) + 2);
  expect.soft(after?.routeMarkers).toBeLessThanOrEqual((baseline?.routeMarkers ?? 0) + 2);
  expect(after?.renderTargets).toBe(baseline?.renderTargets);
  expect(after?.eventListeners).toBe(baseline?.eventListeners);

  const activeLifecycle = await sceneControllerLifecycle(page);
  expect(activeLifecycle.created).toBeGreaterThan(baselineLifecycle.created);
  expect(activeLifecycle.active).toBe(1);
  expect(activeLifecycle.created).toBe(activeLifecycle.destroyed + activeLifecycle.active);
  expect(activeLifecycle.destroyedWithActiveListeners).toBe(0);

  await page.evaluate(() => {
    location.hash = '#/about';
  });
  await expect(page.locator('main.about-page')).toBeVisible();
  await expect.poll(async () => (await sceneControllerLifecycle(page)).active).toBe(0);
  const destroyedLifecycle = await sceneControllerLifecycle(page);
  expect(destroyedLifecycle.created).toBe(destroyedLifecycle.destroyed);
  expect(destroyedLifecycle.destroyedWithActiveListeners).toBe(0);
});
