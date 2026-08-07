import { expect, test } from '@playwright/test';

test('deep link and back navigation restore projection', async ({ page }) => {
  await page.goto('/#/learn/service-and-endpoints/2');
  await expect(
    page.getByRole('heading', { name: /EndpointSlice tracks concrete backends/i }),
  ).toBeVisible();
  await expect(page.locator('.view-badge')).toHaveText('LOGICAL');
  await page.getByRole('button', { name: /Previous/i }).click();
  await expect(page).toHaveURL(/service-and-endpoints\/1$/);
  await expect(page.getByRole('heading', { name: /A Service selects by labels/i })).toBeVisible();
});
