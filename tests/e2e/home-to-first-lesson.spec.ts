import { expect, test } from '@playwright/test';

test('home to first lesson', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('link', { name: /Start the verified lesson/i }).click();
  await expect(
    page.getByRole('heading', { name: /Establish the healthy identity/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/1$/);
  await expect(page.getByRole('heading', { name: /The container process exits/i })).toBeVisible();
});
