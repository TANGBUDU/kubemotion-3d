import { expect, test, type Page } from '@playwright/test';

const SERVICE_LESSON = 'service-routes-to-pods';
const POD_LESSON = 'container-restart-vs-pod-replacement';
const progressKey = 'kubemotion:v1:progress';

async function completedLessonIds(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const completed = (parsed as { completedLessonIds?: unknown }).completedLessonIds;
    return Array.isArray(completed)
      ? completed.filter((lessonId): lessonId is string => typeof lessonId === 'string')
      : [];
  }, progressKey);
}

async function appProgress(page: Page): Promise<{
  completedLessonIds: string[];
  lessonId?: string;
  stepIndex: number;
}> {
  return page.evaluate(() => {
    const state = window.__KUBEMOTION_TEST__?.getAppState();
    return {
      completedLessonIds: Array.isArray(state?.completedLessonIds)
        ? (state.completedLessonIds as string[])
        : [],
      ...(typeof state?.lessonId === 'string' ? { lessonId: state.lessonId } : {}),
      stepIndex: typeof state?.stepIndex === 'number' ? state.stepIndex : -1,
    };
  });
}

test('bare Learn follows manifest order and valid progress resumes', async ({ page }) => {
  await page.goto('/#/learn');
  await expect(page).toHaveURL(/service-routes-to-pods\/0$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'Identify the traffic objects',
  );

  await page.goto('/#/learn/container-restart-vs-pod-replacement/3');
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'kubelet restarts the Container in the same Pod',
  );
  await page.goto('/#/about');
  await page.getByRole('link', { name: 'Learn', exact: true }).click();
  await expect(page).toHaveURL(/container-restart-vs-pod-replacement\/3$/);
});

test('an explicit valid lesson deep link overrides saved progress', async ({ page }) => {
  await page.goto('/#/learn/container-restart-vs-pod-replacement/3');
  await page.goto('/#/learn/service-routes-to-pods/4');

  await expect(page).toHaveURL(/service-routes-to-pods\/4$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'api-a remains listed but becomes NotReady',
  );
});

test('valid lesson deep links normalize missing or invalid steps to that lesson start', async ({
  page,
}) => {
  await page.goto(`/#/learn/${SERVICE_LESSON}/4`);

  await page.goto(`/#/learn/${POD_LESSON}/999`);
  await expect(page).toHaveURL(new RegExp(`${POD_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');

  await page.goto(`/#/learn/${SERVICE_LESSON}/4`);
  await page.goto(`/#/learn/${POD_LESSON}`);
  await expect(page).toHaveURL(new RegExp(`${POD_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
});

test('final steps persist completion and expose a usable next action', async ({ page }) => {
  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  const completion = page.getByTestId('lesson-completion-card');
  await expect(completion).toContainText('Final step ready');
  await expect.poll(() => completedLessonIds(page)).toEqual([]);
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(completion).toContainText('Lesson complete');
  await expect(
    completion.getByRole('link', { name: /Next lesson: Container restart/i }),
  ).toHaveAttribute('href', `#/learn/${POD_LESSON}/0`);

  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);

  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Start lesson', exact: true })).toHaveAttribute(
    'href',
    `#/learn/${POD_LESSON}/0`,
  );

  await page.goto('/#/learn');
  await expect(page).toHaveURL(new RegExp(`${POD_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
});

test('all completed lessons route Home and bare Learn to Explore until Reset', async ({ page }) => {
  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);

  await page.goto(`/#/learn/${POD_LESSON}/9`);
  await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON, POD_LESSON]);

  await page.goto('/#/');
  const explore = page.getByRole('link', { name: 'Explore completed lessons', exact: true });
  await expect(explore).toHaveAttribute('href', '#/explore');
  await explore.click();
  await expect(page).toHaveURL(/\/explore$/);

  await page.goto('/#/learn');
  await expect(page).toHaveURL(/\/explore$/);

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByTestId('app-header')
    .getByRole('button', { name: 'Reset learning progress', exact: true })
    .click();
  await expect.poll(() => completedLessonIds(page)).toEqual([]);
  await expect(page.getByRole('status')).toContainText('Learning progress reset.');

  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Start lesson', exact: true })).toHaveAttribute(
    'href',
    `#/learn/${SERVICE_LESSON}/0`,
  );
});

test('completion skips a next lesson that is already complete', async ({ page }) => {
  await page.addInitScript(
    ({ key, completedLessonId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ completedLessonIds: [completedLessonId], stepIndex: 0 }),
      );
    },
    { key: progressKey, completedLessonId: POD_LESSON },
  );

  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  const completion = page.getByTestId('lesson-completion-card');
  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(
    completion.getByRole('link', { name: 'Explore the verified world', exact: true }),
  ).toHaveAttribute('href', '#/explore');
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);

  await expect.poll(() => completedLessonIds(page)).toEqual([POD_LESSON, SERVICE_LESSON]);
});

test('an out-of-order final lesson points to the first unfinished manifest lesson', async ({
  page,
}) => {
  await page.goto(`/#/learn/${POD_LESSON}/9`);
  const completion = page.getByTestId('lesson-completion-card');
  await expect.poll(() => completedLessonIds(page)).toEqual([]);

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(
    completion.getByRole('link', { name: /Next lesson: How a Service routes/i }),
  ).toHaveAttribute('href', `#/learn/${SERVICE_LESSON}/0`);
  await expect.poll(() => completedLessonIds(page)).toEqual([POD_LESSON]);
});

test('cross-tab navigation preserves external completion and Reset updates', async ({
  context,
  page,
}) => {
  const otherPage = await context.newPage();
  await page.goto(`/#/learn/${SERVICE_LESSON}/0`);
  await otherPage.goto(`/#/learn/${POD_LESSON}/0`);

  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);
  await expect
    .poll(async () => (await appProgress(otherPage)).completedLessonIds)
    .toEqual([SERVICE_LESSON]);

  await otherPage
    .getByTestId('step-timeline')
    .getByRole('button', { name: 'Next', exact: true })
    .click();
  await expect(otherPage).toHaveURL(new RegExp(`${POD_LESSON}/1$`));
  await expect.poll(() => completedLessonIds(otherPage)).toEqual([SERVICE_LESSON]);

  await page.goto('/#/about');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByTestId('app-header')
    .getByRole('button', { name: 'Reset learning progress', exact: true })
    .click();
  await expect.poll(() => completedLessonIds(page)).toEqual([]);
  await expect
    .poll(() => appProgress(otherPage))
    .toMatchObject({
      completedLessonIds: [],
      stepIndex: 0,
    });
  expect((await appProgress(otherPage)).lessonId).toBeUndefined();

  await otherPage.goto('/#/learn');
  await expect(otherPage).toHaveURL(new RegExp(`${SERVICE_LESSON}/0$`));
  await otherPage.close();
});

test('simultaneous cross-tab completions preserve both lessons', async ({ context, page }) => {
  const otherPage = await context.newPage();
  await Promise.all([
    page.goto(`/#/learn/${SERVICE_LESSON}/5`),
    otherPage.goto(`/#/learn/${POD_LESSON}/9`),
  ]);
  const serviceCompletion = page.getByRole('button', { name: 'Complete lesson', exact: true });
  const podCompletion = otherPage.getByRole('button', { name: 'Complete lesson', exact: true });
  await Promise.all([serviceCompletion.click(), podCompletion.click()]);

  const expected = [POD_LESSON, SERVICE_LESSON].sort();
  await expect.poll(async () => (await completedLessonIds(page)).sort()).toEqual(expected);
  await expect
    .poll(async () => (await appProgress(otherPage)).completedLessonIds.sort())
    .toEqual(expected);
  await otherPage.close();
});
