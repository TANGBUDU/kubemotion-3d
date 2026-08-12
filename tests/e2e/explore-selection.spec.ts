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

test('explore keeps every view tab usable when a view has no topology', async ({ page }) => {
  await page.goto('/#/explore');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(6);

  const trafficTab = page.getByRole('tab', { name: 'traffic' });
  await trafficTab.click();

  // The golden Explore world has no Service/EndpointSlice, so Traffic must state that instead of
  // taking the whole page down with a layout contract error.
  await expect(trafficTab).toHaveAttribute('aria-selected', 'true');
  await expect(tabs).toHaveCount(6);
  const unavailable = page.getByTestId('explore-unavailable-view');
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText(/unavailable/i);
  await expect(page.locator('#explore-scene-panel canvas')).toHaveCount(0);

  const overviewTab = page.getByRole('tab', { name: 'overview' });
  await overviewTab.click();
  await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('explore-unavailable-view')).toHaveCount(0);
  await expect(page.locator('#explore-scene-panel canvas')).toHaveCount(1);
});
