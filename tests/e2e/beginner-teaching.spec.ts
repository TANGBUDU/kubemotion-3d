import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { waitForSceneIdle } from './helpers';

const reviewDir = 'docs/review/evidence/beginner';

async function gotoBeginnerLesson(page: Page, lessonId: string, stepIndex: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/learn/${lessonId}/${stepIndex}`);
  await expect(page.locator('.lesson-home-link')).toBeVisible();
  await expect(page.getByTestId('teaching-plain-language')).toBeVisible();
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
  await expect(page.getByTestId('teaching-plain-language')).toContainText(
    'container runtime can be enough',
  );
  await page.screenshot({
    path: `${reviewDir}/02-one-container-is-enough.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 1);
  await expect(page.getByTestId('teaching-plain-language')).toContainText('three copies');
  await page.screenshot({
    path: `${reviewDir}/03-three-copies-create-a-problem.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 3);
  await expect(page.getByTestId('teaching-takeaway')).toContainText(/desired|reality|match/i);
  await page.screenshot({ path: `${reviewDir}/04-one-copy-is-lost.png`, fullPage: false });

  await gotoBeginnerLesson(page, 'why-kubernetes-exists', 4);
  await expect(page.getByTestId('teaching-plain-language')).toContainText(/controller|gap/i);
  await page.screenshot({
    path: `${reviewDir}/05-controller-restores-the-gap.png`,
    fullPage: false,
  });

  await gotoBeginnerLesson(page, 'pending-and-scheduling', 1);
  const schedulerDiagnostics = await page.evaluate(() =>
    window.__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  expect(schedulerDiagnostics?.routeHandles).toBe(1);
  await expect(page.locator('.scene-legend li')).toHaveCount(1);
  await expect(page.locator('.scene-legend')).toContainText(/control command/i);
  await page.screenshot({
    path: `${reviewDir}/06-scheduler-one-control-line.png`,
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/learn/why-kubernetes-exists/0');
  await expect(page.locator('.lesson-home-link')).toBeVisible();
  await expect(page.getByTestId('teaching-sheet')).toHaveClass(/is-collapsed/);
  await expect(page.getByTestId('teaching-plain-language')).toBeVisible();
  await expect(page.getByTestId('teaching-focus-hint')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${reviewDir}/07-mobile-first-screen.png`, fullPage: false });
});
