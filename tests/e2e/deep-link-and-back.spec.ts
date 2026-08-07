import { expect, test } from '@playwright/test';

test('deep link and back navigation restore projection', async ({ page }) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/4');
  await expect(page.getByRole('heading', { name: /new Pending Pod/i })).toBeVisible();
  await expect(page.locator('.view-badge')).toHaveText('PLACEMENT');
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/5$/);
  await page.goBack();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/4$/);
  await expect(page.getByRole('heading', { name: /new Pending Pod/i })).toBeVisible();
  await expect(page.getByTestId('world-inspector')).toContainText('Unscheduled');
});
