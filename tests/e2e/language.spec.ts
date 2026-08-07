import { expect, test } from '@playwright/test';

test('language changes text without changing lesson position', async ({ page }) => {
  await page.goto('/#/learn/cluster-overview/1');
  await page.locator('#locale').selectOption('ja');
  await expect(page).toHaveURL(/cluster-overview\/1$/);
  await expect(page.getByRole('heading', { name: '望ましい状態を宣言する' })).toBeVisible();
  await page.locator('#locale').selectOption('zh-CN');
  await expect(page.getByRole('heading', { name: '声明你希望的状态' })).toBeVisible();
});
