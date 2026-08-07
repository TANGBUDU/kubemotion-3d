import { expect, test } from '@playwright/test';
import { GOLDEN_LESSON, waitForSceneIdle } from './helpers';

test('mobile teaching sheet, timeline, drawers, and controls do not cover one another', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-only interaction gate');
  await page.goto(`/#/learn/${GOLDEN_LESSON}/0`);
  await waitForSceneIdle(page);

  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
  await expect(page.getByTestId('teaching-what-changed')).toBeVisible();
  await expect(page.getByTestId('evidence-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: /Open course contents/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    };
    return {
      stage: rect('.lesson-stage-frame'),
      sheet: rect('.mobile-teaching-sheet'),
      timeline: rect('.step-timeline'),
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(layout.stage.bottom).toBeLessThanOrEqual(layout.sheet.top + 1);
  expect(layout.sheet.bottom).toBeLessThanOrEqual(layout.timeline.top + 1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

  await page.getByRole('button', { name: /Collapse teaching details/i }).click();
  await expect(page.getByTestId('teaching-what-changed')).toBeVisible();
  await page.getByRole('button', { name: /Show teaching details/i }).click();
  await expect(page.getByTestId('evidence-panel')).toBeVisible();

  await page.getByRole('button', { name: /Open course contents/i }).click();
  const courseDialog = page.getByRole('dialog', { name: /Kubernetes Foundations/i });
  await expect(courseDialog).toBeVisible();
  await courseDialog.getByRole('button', { name: /Close course contents/i }).click();

  await page.getByRole('button', { name: /Go to step 7:/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/6$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText('Pending and unscheduled');
  await page.getByRole('button', { name: /Replay step/i }).click();
  await page.getByRole('button', { name: /^Next$/i }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/7$/);
  await waitForSceneIdle(page);
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3 OBSERVED 3 READY 2/);
});
