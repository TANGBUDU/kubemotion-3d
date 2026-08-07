import { expect, test } from '@playwright/test';

test('home to first lesson', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByText('Control Plane decides.')).toBeVisible();
  await page.getByRole('link', { name: /^Start lesson$/i }).click();
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/1$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'Establish the healthy baseline',
  );
});
