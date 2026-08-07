import { expect, test } from '@playwright/test';

test('language changes text without changing lesson position', async ({ page }) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/2');
  await page.locator('#locale').selectOption('ja');
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/2$/);
  await expect(
    page.getByRole('heading', { name: 'kubelet が同じ Pod 内でコンテナを再起動する' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('#locale')).toHaveValue('ja');
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/2$/);
  await page.locator('#locale').selectOption('zh-CN');
  await expect(page.getByRole('heading', { name: 'kubelet 在同一 Pod 内重启容器' })).toBeVisible();
});
