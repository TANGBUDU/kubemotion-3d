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

test('Pending child is exposed to assistive technology as a Container status slot', async ({
  page,
}) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/5');
  const lessonLanguage = page.locator('.lesson-language select');
  const summary = page.locator('#scene-accessible-summary');

  await lessonLanguage.selectOption('ja');
  await expect(summary).toContainText(
    'kubelet がランタイム Container を作成するのを待っている Container 状態スロットです。',
  );

  await lessonLanguage.selectOption('zh-CN');
  await expect(summary).toContainText('等待 kubelet 创建运行时容器的容器状态槽。');
});
