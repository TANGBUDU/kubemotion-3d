import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { waitForSceneIdle } from './helpers';

const reviewDir = 'docs/review/evidence/beginner';

async function gotoBeginnerLesson(page: Page, lessonId: string, stepIndex: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/learn/${lessonId}/${stepIndex}`);
  await expect(page.locator('.lesson-home-link')).toBeVisible();
  if ((await page.viewportSize())?.width && (await page.viewportSize())!.width > 720) {
    await expect(page.locator('.lesson-home-link')).toContainText(/Back to home/i);
  }
  await expect(page.getByTestId('teaching-plain-language')).toBeVisible();

  const isProblemStage = lessonId === 'why-kubernetes-exists' && stepIndex <= 4;
  if (isProblemStage) {
    await expect(page.getByTestId('beginner-problem-stage')).toBeVisible();
    await expect(page.locator('.scene-legend li')).toHaveCount(0);
    return;
  }

  await expect(page.getByTestId('teaching-focus-hint')).toBeVisible();
  await waitForSceneIdle(page);
  const legendItems = page.locator('.scene-legend li');
  expect(await legendItems.count()).toBeLessThanOrEqual(2);
}

test('beginner journey stays problem-first and visually focused', async ({ page }) => {
  await mkdir(reviewDir, { recursive: true });

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /Why Kubernetes\?/i })).toBeVisible();
  await expect(page.getByTestId('orientation-card')).toContainText(
    'One app can run without Kubernetes.',
  );
  await page.screenshot({
    path: `${reviewDir}/01-home-why-kubernetes.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 0);
  await expect(page.getByTestId('beginner-problem-stage')).toHaveAttribute(
    'data-concept',
    'single-container',
  );
  await expect(page.getByTestId('beginner-problem-stage')).toContainText(
    /One container can already run your app/i,
  );
  await expect(page.getByTestId('teaching-plain-language')).toContainText(
    'container runtime can be enough',
  );
  await page.screenshot({
    path: `${reviewDir}/02-one-container-is-enough.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 1);
  await expect(page.getByTestId('beginner-problem-stage')).toHaveAttribute(
    'data-concept',
    'manual-replicas',
  );
  await expect(page.getByTestId('beginner-problem-stage')).toContainText(
    /Keeping three healthy is the hard part/i,
  );
  await expect(page.getByTestId('teaching-plain-language')).toContainText('three copies');
  await page.screenshot({
    path: `${reviewDir}/03-three-copies-create-a-problem.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 2);
  await expect(page.getByTestId('beginner-problem-stage')).toHaveAttribute(
    'data-concept',
    'desired-state',
  );
  await expect(page.getByTestId('beginner-problem-stage')).toContainText(/Desired state/i);
  await page.screenshot({
    path: `${reviewDir}/04-desired-state-is-a-promise.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 3);
  await expect(page.getByTestId('beginner-problem-stage')).toHaveAttribute(
    'data-concept',
    'replica-gap',
  );
  await expect(page.getByTestId('beginner-problem-stage')).toContainText(/Gap to repair/i);
  await page.screenshot({
    path: `${reviewDir}/05-one-copy-is-lost.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 4);
  await expect(page.getByTestId('beginner-problem-stage')).toHaveAttribute(
    'data-concept',
    'controller-loop',
  );
  await expect(page.getByTestId('beginner-problem-stage')).toContainText(/Observe/i);
  await expect(page.getByTestId('component-explanation')).toContainText(
    /does not choose the Node/i,
  );
  await page.screenshot({
    path: `${reviewDir}/06-controller-loop-explained.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 5);
  let diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  expect(diagnostics?.routeHandles).toBe(1);
  await expect(page.locator('.scene-legend li')).toHaveCount(1);
  await expect(page.locator('.scene-legend')).toContainText(/control command/i);
  await expect(page.locator('.scene-route-label:not([hidden])').first()).toContainText(/worker-c/i);
  await expect(page.getByTestId('component-explanation')).toContainText(/choose|Node/i);
  await page.screenshot({
    path: `${reviewDir}/07-scheduler-records-node.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 6);
  diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  expect(diagnostics?.routeHandles).toBe(1);
  await expect(page.locator('.scene-legend')).toContainText(/choose a Node/i);
  await page.screenshot({
    path: `${reviewDir}/08-binding-places-pod.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 7);
  diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  expect(diagnostics?.routeHandles).toBe(1);
  await expect(page.locator('.scene-legend')).toContainText(/inside one Node/i);
  await expect(page.getByTestId('component-explanation')).toContainText(/assigned to one Node/i);
  await page.screenshot({
    path: `${reviewDir}/09-kubelet-starts-container.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 8);
  await expect(page.getByTestId('teaching-takeaway')).toContainText(/declare|reality/i);
  const completionTitle = page.locator('#lesson-completion-title');
  await expect(completionTitle).toHaveText('Why Kubernetes? From one container to self-healing');
  const completionTitleClips = await completionTitle.evaluate((element) => {
    const card = element.closest('.lesson-completion-card');
    if (!card) return true;
    const titleRect = element.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return (
      element.scrollWidth > element.clientWidth + 1 ||
      titleRect.right > cardRect.right + 1 ||
      titleRect.bottom > cardRect.bottom + 1
    );
  });
  expect(completionTitleClips).toBe(false);
  await page.screenshot({
    path: `${reviewDir}/10-ready-restores-capacity.png`,
    fullPage: false,
  });

  await page.getByLabel('Lesson language').selectOption('zh-CN');
  await page.goto('/#/learn/why-kubernetes-exists/2');
  await expect(page.getByTestId('beginner-problem-stage')).toContainText('期望状态');
  await page.screenshot({
    path: `${reviewDir}/11-zh-desired-state.png`,
    fullPage: false,
  });

  await page.goto('/#/learn/why-kubernetes-exists/6');
  await waitForSceneIdle(page);
  await expect(page.getByTestId('scene-orientation')).toContainText('应用运行层级');
  await expect(page.locator('.scene-label').filter({ hasText: /api-7f8d9-a/i })).toHaveCount(0);
  await expect(
    page
      .locator('.scene-label')
      .filter({ hasText: /工作节点 C|api Pod D/i })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: `${reviewDir}/12-zh-placement-hierarchy.png`,
    fullPage: false,
  });

  await page.goto('/#/learn/why-kubernetes-exists/4');
  await expect(page.getByTestId('beginner-problem-stage')).toContainText('观察');
  await expect(page.getByTestId('component-explanation')).toContainText('期望的状态');
  await expect(page.getByTestId('component-explanation')).toContainText('它不负责');
  await page.screenshot({
    path: `${reviewDir}/13-zh-controller-loop.png`,
    fullPage: false,
  });

  await page.goto('/#/learn/why-kubernetes-exists/5');
  await waitForSceneIdle(page);
  diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  expect(diagnostics?.routeHandles).toBe(1);
  await expect(page.locator('.scene-legend li')).toHaveCount(1);
  await expect(page.locator('.scene-route-label:not([hidden])').first()).toContainText(/worker-c/i);
  await page.screenshot({
    path: `${reviewDir}/14-zh-scheduler-one-line.png`,
    fullPage: false,
  });

  const homeLinks = page.locator('.lesson-home-link, .timeline-home-link');
  await expect(homeLinks.first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/learn/why-kubernetes-exists/0');
  await expect(page.locator('.lesson-home-link')).toBeVisible();
  await expect(page.getByTestId('beginner-problem-stage')).toBeVisible();
  await expect(page.getByTestId('teaching-sheet')).toHaveClass(/is-collapsed/);
  await expect(page.getByTestId('teaching-plain-language')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${reviewDir}/15-mobile-first-screen.png`, fullPage: false });
});
