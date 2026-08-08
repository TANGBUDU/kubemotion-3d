import { expect, test } from '@playwright/test';

test('home to first lesson', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByText('Control Plane decides.')).toBeVisible();
  await page.getByRole('link', { name: /^Start lesson$/i }).click();
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'Identify the traffic objects',
  );
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/service-routes-to-pods\/1$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText('The Service stays stable');
});
