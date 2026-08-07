import { expect, test } from '@playwright/test';

test('deep link and back navigation restore projection', async ({ page }) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/6');
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'The new Pod is Pending and unscheduled',
  );
  await expect(page.locator('.view-badge')).toHaveText('CONTROL FLOW');
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/7$/);
  await page.goBack();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/6$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'The new Pod is Pending and unscheduled',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled');
});
