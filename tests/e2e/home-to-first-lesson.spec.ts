import { expect, test } from '@playwright/test';

test('home to first lesson', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByText('One app can run without Kubernetes.')).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Interactive lesson preview: Why Kubernetes? From one container to self-healing',
    }),
  ).toBeVisible();
  await expect(page.locator('.scene-caption')).toContainText(
    'CURRENT LESSON · Why Kubernetes? From one container to self-healing',
  );
  await page.getByRole('link', { name: /^Start lesson$/i }).click();
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'Start simple: one container can run the app',
  );
  await page.getByRole('button', { name: /Next/i }).click();
  await expect(page).toHaveURL(/why-kubernetes-exists\/1$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'The real problem: keep three copies running',
  );
});

test('localized home preview and entry stay on the same lesson', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('#locale').selectOption('zh-CN');

  await expect(
    page.getByRole('img', {
      name: '交互式课程预览: 为什么需要 Kubernetes？从一个容器到自动恢复',
    }),
  ).toBeVisible();
  await expect(page.locator('.scene-caption')).toContainText(
    '当前课程 · 为什么需要 Kubernetes？从一个容器到自动恢复',
  );

  const startLesson = page.getByRole('link', { name: '开始课程' });
  await expect(startLesson).toHaveAttribute('href', '#/learn/why-kubernetes-exists/0');
  await startLesson.click();
  await expect(page).toHaveURL(/why-kubernetes-exists\/0$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    '先从最简单开始：一个容器就能跑应用',
  );
});

test('saved Pod progress previews step zero while the action resumes step three', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'kubemotion:v1:progress',
      JSON.stringify({
        completedLessonIds: [],
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 3,
      }),
    );
    localStorage.setItem(
      'kubemotion:v1:preferences',
      JSON.stringify({
        locale: 'en',
        courseNavCollapsed: false,
        inspectorCollapsed: false,
        orientationSeen: true,
      }),
    );
  });

  await page.goto('/#/');

  await expect(
    page.getByRole('img', {
      name: 'Interactive lesson preview: Container restart is not Pod replacement',
    }),
  ).toBeVisible();
  await expect(page.locator('.scene-caption')).toContainText(
    'CURRENT LESSON · Container restart is not Pod replacement',
  );
  await expect(page.getByTestId('scene-viewport')).toHaveAttribute('data-renderer-state', 'ready');
  await expect(
    page.locator('.scene-label[data-entity-id="api-object:namespaced:shop:Pod:api-a-old"]'),
  ).toHaveCount(1);
  await expect(page.locator('.scene-route-label')).toHaveCount(0);

  const resumeLesson = page.getByRole('link', { name: 'Continue learning', exact: true });
  await expect(resumeLesson).toHaveAttribute(
    'href',
    '#/learn/container-restart-vs-pod-replacement/3',
  );
  await resumeLesson.click();

  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/3$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'kubelet restarts the Container in the same Pod',
  );
});
