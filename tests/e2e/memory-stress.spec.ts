import { expect, test } from '@playwright/test';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import { GOLDEN_LESSON, STEP_TITLES, gotoGoldenStep, waitForSceneIdle } from './helpers';

test('20 navigation/replay/locale/selection/reset cycles keep resources bounded', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop renderer stress gate');
  test.setTimeout(120_000);

  for (let stepIndex = 0; stepIndex < STEP_TITLES.length; stepIndex += 1) {
    await gotoGoldenStep(page, stepIndex);
    await page.getByRole('button', { name: /Replay/i }).click();
    await waitForSceneIdle(page);
  }
  const baseline = await page.evaluate(
    () => window.__KUBEMOTION_TEST__?.getSceneDiagnostics() as SceneDiagnostics | undefined,
  );
  expect(baseline).toBeDefined();

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.locator('#locale').selectOption('en');
    const stepIndex = cycle % STEP_TITLES.length;
    const title = STEP_TITLES[stepIndex];
    if (!title) throw new Error(`Unknown golden lesson step ${stepIndex}`);
    await page.evaluate(
      ({ lessonId, index }) => {
        location.hash = `#/learn/${lessonId}/${index}`;
      },
      { lessonId: GOLDEN_LESSON, index: stepIndex },
    );
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.evaluate(() =>
      window.__KUBEMOTION_TEST__?.selectEntity('api-object:namespaced:shop:ReplicaSet:api-rs'),
    );
    await page
      .locator('#locale')
      .selectOption(cycle % 3 === 0 ? 'ja' : cycle % 3 === 1 ? 'zh-CN' : 'en');
    await page.getByRole('button', { name: /Replay|再生|重播/i }).click();
    await page.getByRole('button', { name: /Reset camera|カメラをリセット|重置相机/i }).click();
  }

  await page.locator('#locale').selectOption('en');
  await page.evaluate(
    ({ lessonId }) => {
      location.hash = `#/learn/${lessonId}/6`;
    },
    { lessonId: GOLDEN_LESSON },
  );
  await expect(page.getByRole('heading', { name: STEP_TITLES[6] })).toBeVisible();
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
  expect(after?.geometries).toBeLessThanOrEqual((baseline?.geometries ?? 0) + 2);
  expect(after?.textures).toBeLessThanOrEqual((baseline?.textures ?? 0) + 2);
  expect(after?.programs).toBeLessThanOrEqual((baseline?.programs ?? 0) + 2);
  expect(after?.drawCalls).toBeLessThanOrEqual((baseline?.drawCalls ?? 0) + 2);
  expect(after?.pooledTokens).toBeLessThanOrEqual((baseline?.pooledTokens ?? 0) + 2);
});
