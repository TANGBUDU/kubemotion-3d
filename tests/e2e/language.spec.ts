import { expect, test } from '@playwright/test';

test('language changes text without changing lesson position', async ({ page }) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/3');
  const lessonLanguage = page.locator('.lesson-language select');
  await lessonLanguage.selectOption('ja');
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/3$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'kubelet が同じ Pod 内で Container を再起動する',
  );
  await page.reload();
  await expect(lessonLanguage).toHaveValue('ja');
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/3$/);
  await lessonLanguage.selectOption('zh-CN');
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'kubelet 在同一 Pod 内重启容器',
  );
});
