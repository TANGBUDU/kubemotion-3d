import { expect, test } from '@playwright/test';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import {
  GOLDEN_LESSON,
  SERVICE_LESSON,
  SERVICE_STEP_TITLES,
  STEP_TITLES,
  gotoGoldenStep,
  gotoServiceStep,
  waitForSceneIdle,
} from './helpers';

test('20 navigation/replay/locale/selection/reset cycles keep resources bounded', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop renderer stress gate');
  test.setTimeout(180_000);

  for (let stepIndex = 0; stepIndex < STEP_TITLES.length; stepIndex += 1) {
    await gotoGoldenStep(page, stepIndex);
    await page.getByRole('button', { name: /Replay/i }).click();
    await waitForSceneIdle(page);
  }
  for (let stepIndex = 0; stepIndex < SERVICE_STEP_TITLES.length; stepIndex += 1) {
    await gotoServiceStep(page, stepIndex);
    await page.getByRole('button', { name: /Replay/i }).click();
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

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.locator('.lesson-language select').selectOption('en');
    const serviceCycle = cycle % 2 === 1;
    const lessonId = serviceCycle ? SERVICE_LESSON : GOLDEN_LESSON;
    const titles = serviceCycle ? SERVICE_STEP_TITLES : STEP_TITLES;
    const stepIndex = cycle % titles.length;
    const title = titles[stepIndex];
    if (!title) throw new Error(`Unknown ${lessonId} lesson step ${stepIndex}`);
    await page.evaluate(
      ({ lessonId, index }) => {
        location.hash = `#/learn/${lessonId}/${index}`;
      },
      { lessonId, index: stepIndex },
    );
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    if (!serviceCycle) {
      await page.evaluate(() =>
        window.__KUBEMOTION_TEST__?.selectEntity('api-object:namespaced:shop:ReplicaSet:api-rs'),
      );
    }
    await page
      .locator('.lesson-language select')
      .selectOption(cycle % 3 === 0 ? 'ja' : cycle % 3 === 1 ? 'zh-CN' : 'en');
    await page.getByRole('button', { name: /Replay|再生|重播/i }).click();
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
});
