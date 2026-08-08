import { expect, test } from '@playwright/test';

test('explore selection opens inspector', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('tab', { name: 'placement' }).click();
  await page
    .getByRole('combobox', { name: 'Inspect an object' })
    .selectOption('api-object:namespaced:shop:Pod:api-a-old');
  const inspector = page.getByRole('dialog', { name: /api-7f8d9-a/ });
  await expect(inspector).toContainText('worker-a');
  const trafficTab = page.getByRole('tab', { name: 'traffic' });
  await trafficTab.focus();
  await page.keyboard.press('Enter');
  await expect(trafficTab).toHaveAttribute('aria-selected', 'true');
  await expect(inspector).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Inspect an object' })).toBeFocused();
});
