import { expect, test } from '@playwright/test';
import { GOLDEN_LESSON, waitForSceneIdle } from './helpers';

test('mobile step selector, bottom controls, drawers, replay, and camera reset work', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only interaction gate');
  await page.goto(`/#/learn/${GOLDEN_LESSON}/0`);
  await page.locator('.mobile-step-select select').selectOption('4');
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/4$/);
  await expect(page.getByRole('heading', { name: /new Pending Pod/i })).toBeVisible();
  await page.getByRole('button', { name: /Collapse lesson rail/i }).click();
  await page.getByRole('button', { name: /Collapse explanation/i }).click();
  await page.getByRole('button', { name: /Replay/i }).click();
  await page.getByRole('button', { name: /Reset camera/i }).click();
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/5$/);
  await waitForSceneIdle(page);
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);
  await expect(page).toHaveScreenshot('mobile-step-06.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
  });
});
