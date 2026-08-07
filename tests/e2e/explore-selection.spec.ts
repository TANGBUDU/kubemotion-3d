import { expect, test } from '@playwright/test';

test('explore selection opens inspector', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('tab', { name: 'placement' }).click();
  await page.waitForFunction(() => Boolean(window.__KUBEMOTION_TEST__));
  await page.evaluate(() =>
    window.__KUBEMOTION_TEST__?.selectEntity('api-object:namespaced:shop:Pod:api-a'),
  );
  await expect(page.locator('.inspector')).toContainText('shop');
  await expect(page.locator('.inspector')).toContainText('worker-a');
  await page.keyboard.press('Escape');
  await expect(page.locator('.inspector')).toHaveCount(0);
});
