import { expect, test } from '@playwright/test';

test('repeated navigation returns animations to idle', async ({ page }) => {
  await page.goto('/#/learn/cluster-overview/0');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: /Next/i }).click();
    await page.getByRole('button', { name: /Previous/i }).click();
  }
  await page.waitForTimeout(1500);
  const diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  expect(diagnostics?.activeAnimations).toBe(0);
  expect(diagnostics?.entities).toBeLessThanOrEqual(34);
  expect(diagnostics?.labels).toBeLessThanOrEqual(34);
});
