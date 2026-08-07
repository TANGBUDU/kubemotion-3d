import { expect, test } from '@playwright/test';

test('home to first lesson', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('link', { name: /Start learning/i }).click();
  await expect(page.getByRole('heading', { name: /One system, not one machine/i })).toBeVisible();
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/cluster-overview\/1$/);
  await expect(page.getByRole('heading', { name: /Declare the state you want/i })).toBeVisible();
});
