import { expect, test, type Page } from '@playwright/test';

const CLUSTER_LESSON = 'cluster-overview';
const POD_PLACEMENT_LESSON = 'pod-and-placement';
const MANIFEST_LESSON = 'manifest-to-running-pod';
const SERVICE_LESSON = 'service-routes-to-pods';
const RESTART_LESSON = 'container-restart-vs-pod-replacement';
const progressKey = 'kubemotion:v1:progress';

const availableLessons = [
  { id: CLUSTER_LESSON, finalStep: 4 },
  { id: POD_PLACEMENT_LESSON, finalStep: 5 },
  { id: MANIFEST_LESSON, finalStep: 7 },
  { id: SERVICE_LESSON, finalStep: 5 },
  { id: RESTART_LESSON, finalStep: 9 },
] as const;

async function seedCompletedLessons(page: Page, completedLessonIds: readonly string[]) {
  await page.addInitScript(
    ({ key, lessonIds }) => {
      localStorage.setItem(key, JSON.stringify({ completedLessonIds: lessonIds, stepIndex: 0 }));
    },
    { key: progressKey, lessonIds: [...completedLessonIds] },
  );
}

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
  progressSaveStatusByLesson: Record<string, string>;
}> {
  return page.evaluate(() => {
    const state = window.__KUBEMOTION_TEST__?.getAppState();
    return {
      completedLessonIds: Array.isArray(state?.completedLessonIds)
        ? (state.completedLessonIds as string[])
        : [],
      ...(typeof state?.lessonId === 'string' ? { lessonId: state.lessonId } : {}),
      stepIndex: typeof state?.stepIndex === 'number' ? state.stepIndex : -1,
      progressSaveStatusByLesson:
        state?.progressSaveStatusByLesson &&
        typeof state.progressSaveStatusByLesson === 'object' &&
        !Array.isArray(state.progressSaveStatusByLesson)
          ? (state.progressSaveStatusByLesson as Record<string, string>)
          : {},
    };
  });
}

async function holdProgressLock(page: Page): Promise<() => Promise<void>> {
  await page.evaluate((key) => {
    const testWindow = window as typeof window & {
      __KUBEMOTION_PROGRESS_LOCK__?: { acquired: boolean; release?: () => void };
    };
    const control: { acquired: boolean; release?: () => void } = { acquired: false };
    testWindow.__KUBEMOTION_PROGRESS_LOCK__ = control;
    void navigator.locks.request(key, async () => {
      control.acquired = true;
      await new Promise<void>((resolve) => {
        control.release = resolve;
      });
    });
  }, progressKey);
  await page.waitForFunction(
    () =>
      (
        window as typeof window & {
          __KUBEMOTION_PROGRESS_LOCK__?: { acquired: boolean };
        }
      ).__KUBEMOTION_PROGRESS_LOCK__?.acquired === true,
  );
  return async () => {
    await page.evaluate(() => {
      (
        window as typeof window & {
          __KUBEMOTION_PROGRESS_LOCK__?: { release?: () => void };
        }
      ).__KUBEMOTION_PROGRESS_LOCK__?.release?.();
    });
  };
}

async function failProgressWritesUntilReleased(page: Page): Promise<() => Promise<void>> {
  await page.evaluate((key) => {
    const testWindow = window as typeof window & {
      __KUBEMOTION_ALLOW_PROGRESS_WRITES__?: () => void;
    };
    const originalSetItem = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (storageKey, value) {
      if (fail && storageKey === key) {
        throw new DOMException('Storage denied by test', 'QuotaExceededError');
      }
      originalSetItem.call(this, storageKey, value);
    };
    testWindow.__KUBEMOTION_ALLOW_PROGRESS_WRITES__ = () => {
      fail = false;
    };
  }, progressKey);
  return async () => {
    await page.evaluate(() => {
      (
        window as typeof window & {
          __KUBEMOTION_ALLOW_PROGRESS_WRITES__?: () => void;
        }
      ).__KUBEMOTION_ALLOW_PROGRESS_WRITES__?.();
    });
  };
}

test('bare Learn follows manifest order and valid progress resumes', async ({ page }) => {
  await page.goto('/#/learn');
  await expect(page).toHaveURL(/cluster-overview\/0$/);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'One cluster, two areas of responsibility',
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

  await page.goto(`/#/learn/${RESTART_LESSON}/999`);
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');

  await page.goto(`/#/learn/${SERVICE_LESSON}/4`);
  await page.goto(`/#/learn/${RESTART_LESSON}`);
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
});

test('final steps persist completion and expose a usable next action', async ({ page }) => {
  const completedBeforeService = [CLUSTER_LESSON, POD_PLACEMENT_LESSON, MANIFEST_LESSON];
  await seedCompletedLessons(page, completedBeforeService);
  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  const completion = page.getByTestId('lesson-completion-card');
  await expect(completion).toContainText('Final step ready');
  await expect.poll(() => completedLessonIds(page)).toEqual(completedBeforeService);
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(completion).toContainText('Lesson complete');
  await expect(
    completion.getByRole('link', { name: /Next lesson: Container restart/i }),
  ).toHaveAttribute('href', `#/learn/${RESTART_LESSON}/0`);

  await expect
    .poll(() => completedLessonIds(page))
    .toEqual([...completedBeforeService, SERVICE_LESSON]);

  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Start lesson', exact: true })).toHaveAttribute(
    'href',
    `#/learn/${RESTART_LESSON}/0`,
  );

  await page.goto('/#/learn');
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/0$`));
  await expect(page.getByTestId('teaching-step-heading')).toContainText('What you are looking at');
});

test('all completed lessons route Home and bare Learn to Explore until Reset', async ({ page }) => {
  const completedInOrder: string[] = [];
  for (const lesson of availableLessons) {
    await page.goto(`/#/learn/${lesson.id}/${lesson.finalStep}`);
    await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();
    completedInOrder.push(lesson.id);
    await expect.poll(() => completedLessonIds(page)).toEqual(completedInOrder);
  }

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
    `#/learn/${CLUSTER_LESSON}/0`,
  );
});

test('completion skips a next lesson that is already complete', async ({ page }) => {
  const completedExceptService = [
    CLUSTER_LESSON,
    POD_PLACEMENT_LESSON,
    MANIFEST_LESSON,
    RESTART_LESSON,
  ];
  await seedCompletedLessons(page, completedExceptService);

  await page.goto(`/#/learn/${SERVICE_LESSON}/5`);
  const completion = page.getByTestId('lesson-completion-card');
  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(
    completion.getByRole('link', { name: 'Explore the verified world', exact: true }),
  ).toHaveAttribute('href', '#/explore');
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);

  await expect
    .poll(() => completedLessonIds(page))
    .toEqual([...completedExceptService, SERVICE_LESSON]);
});

test('an out-of-order final lesson points to the first unfinished manifest lesson', async ({
  page,
}) => {
  await page.goto(`/#/learn/${RESTART_LESSON}/9`);
  const completion = page.getByTestId('lesson-completion-card');
  await expect.poll(() => completedLessonIds(page)).toEqual([]);

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(
    completion.getByRole('link', { name: /Next lesson: What a Kubernetes cluster contains/i }),
  ).toHaveAttribute('href', `#/learn/${CLUSTER_LESSON}/0`);
  await expect.poll(() => completedLessonIds(page)).toEqual([RESTART_LESSON]);
});

test('cross-tab navigation preserves external completion and Reset updates', async ({
  context,
  page,
}) => {
  const otherPage = await context.newPage();
  await page.goto(`/#/learn/${SERVICE_LESSON}/0`);
  await otherPage.goto(`/#/learn/${RESTART_LESSON}/0`);

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
  await expect(otherPage).toHaveURL(new RegExp(`${RESTART_LESSON}/1$`));
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
  await expect(otherPage).toHaveURL(new RegExp(`${CLUSTER_LESSON}/0$`));
  await otherPage.close();
});

test('simultaneous cross-tab completions preserve both lessons', async ({ context, page }) => {
  const otherPage = await context.newPage();
  await Promise.all([
    page.goto(`/#/learn/${SERVICE_LESSON}/5`),
    otherPage.goto(`/#/learn/${RESTART_LESSON}/9`),
  ]);
  const serviceCompletion = page.getByRole('button', { name: 'Complete lesson', exact: true });
  const podCompletion = otherPage.getByRole('button', { name: 'Complete lesson', exact: true });
  await Promise.all([serviceCompletion.click(), podCompletion.click()]);

  const expected = [RESTART_LESSON, SERVICE_LESSON].sort();
  await expect.poll(async () => (await completedLessonIds(page)).sort()).toEqual(expected);
  await expect
    .poll(async () => (await appProgress(otherPage)).completedLessonIds.sort())
    .toEqual(expected);
  await otherPage.close();
});

for (const completionOrder of ['service-first', 'pod-first'] as const) {
  test(`forced lock order ${completionOrder} converges both completion writers`, async ({
    context,
    page,
  }) => {
    const otherPage = await context.newPage();
    const holderPage = await context.newPage();
    await Promise.all([
      page.goto(`/#/learn/${SERVICE_LESSON}/5`),
      otherPage.goto(`/#/learn/${RESTART_LESSON}/9`),
      holderPage.goto('/#/about'),
    ]);
    const releaseLock = await holdProgressLock(holderPage);
    const serviceComplete = page.getByRole('button', {
      name: 'Complete lesson',
      exact: true,
    });
    const podComplete = otherPage.getByRole('button', {
      name: 'Complete lesson',
      exact: true,
    });
    const [first, second] =
      completionOrder === 'service-first'
        ? [serviceComplete, podComplete]
        : [podComplete, serviceComplete];

    await first.click();
    await expect(first).toHaveCount(0);
    await second.click();
    await expect
      .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
      .toBe('saving');
    await expect
      .poll(async () => (await appProgress(otherPage)).progressSaveStatusByLesson[RESTART_LESSON])
      .toBe('saving');

    await releaseLock();

    const expected = [RESTART_LESSON, SERVICE_LESSON].sort();
    await expect.poll(async () => (await completedLessonIds(page)).sort()).toEqual(expected);
    await expect
      .poll(async () => (await appProgress(page)).completedLessonIds.sort())
      .toEqual(expected);
    await expect
      .poll(async () => (await appProgress(otherPage)).completedLessonIds.sort())
      .toEqual(expected);
    await expect
      .poll(async () => (await appProgress(holderPage)).completedLessonIds.sort())
      .toEqual(expected);
    await expect
      .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
      .toBe('saved');
    await expect
      .poll(async () => (await appProgress(otherPage)).progressSaveStatusByLesson[RESTART_LESSON])
      .toBe('saved');
    await Promise.all([otherPage.close(), holderPage.close()]);
  });
}

test('a held completion reports saving, then converges before Complete to Next', async ({
  context,
  page,
}) => {
  const otherPage = await context.newPage();
  await Promise.all([page.goto(`/#/learn/${SERVICE_LESSON}/5`), otherPage.goto('/#/about')]);
  const releaseLock = await holdProgressLock(otherPage);
  const completion = page.getByTestId('lesson-completion-card');

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await expect(completion.getByRole('status')).toContainText('Saving');
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
    .toBe('saving');

  await page.getByRole('button', { name: 'Open course contents', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Kubernetes Foundations' })
    .getByRole('link', { name: /Container restart is not Pod replacement/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/0$`));
  await expect
    .poll(() => appProgress(page))
    .toMatchObject({
      lessonId: RESTART_LESSON,
      stepIndex: 0,
      completedLessonIds: [SERVICE_LESSON],
      progressSaveStatusByLesson: { [SERVICE_LESSON]: 'saving' },
    });

  await releaseLock();

  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);
  await expect
    .poll(() => appProgress(page))
    .toMatchObject({
      lessonId: RESTART_LESSON,
      stepIndex: 0,
      completedLessonIds: [SERVICE_LESSON],
      progressSaveStatusByLesson: { [SERVICE_LESSON]: 'saved' },
    });
  await expect
    .poll(async () => (await appProgress(otherPage)).completedLessonIds)
    .toEqual([SERVICE_LESSON]);
  await otherPage.close();
});

test('same-tab A to B to A completion cards keep independent held-lock status', async ({
  context,
  page,
}) => {
  const holderPage = await context.newPage();
  await Promise.all([page.goto(`/#/learn/${SERVICE_LESSON}/5`), holderPage.goto('/#/about')]);
  const releaseLock = await holdProgressLock(holderPage);
  const completion = page.getByTestId('lesson-completion-card');

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await page.evaluate(
    ([lessonId, stepIndex]) => {
      window.__KUBEMOTION_TEST__?.goToLessonStep(lessonId, stepIndex);
    },
    [RESTART_LESSON, 9] as const,
  );
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/9$`));
  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await expect(completion.getByText('Lesson complete')).toHaveCount(0);

  await page.evaluate(
    ([lessonId, stepIndex]) => {
      window.__KUBEMOTION_TEST__?.goToLessonStep(lessonId, stepIndex);
    },
    [SERVICE_LESSON, 5] as const,
  );
  await expect(page).toHaveURL(new RegExp(`${SERVICE_LESSON}/5$`));
  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await expect(completion.getByText('Lesson complete')).toHaveCount(0);
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);

  await page.evaluate(
    ([lessonId, stepIndex]) => {
      window.__KUBEMOTION_TEST__?.goToLessonStep(lessonId, stepIndex);
    },
    [RESTART_LESSON, 9] as const,
  );
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/9$`));
  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson)
    .toMatchObject({
      [SERVICE_LESSON]: 'saving',
      [RESTART_LESSON]: 'saving',
    });

  await releaseLock();

  await expect(completion).toHaveAttribute('data-save-status', 'saved');
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson)
    .toMatchObject({
      [SERVICE_LESSON]: 'saved',
      [RESTART_LESSON]: 'saved',
    });
  await page.evaluate(
    ([lessonId, stepIndex]) => {
      window.__KUBEMOTION_TEST__?.goToLessonStep(lessonId, stepIndex);
    },
    [SERVICE_LESSON, 5] as const,
  );
  await expect(page).toHaveURL(new RegExp(`${SERVICE_LESSON}/5$`));
  await expect(completion).toHaveAttribute('data-save-status', 'saved');
  const expected = [RESTART_LESSON, SERVICE_LESSON].sort();
  await expect.poll(async () => (await completedLessonIds(page)).sort()).toEqual(expected);
  await expect
    .poll(async () => (await appProgress(holderPage)).completedLessonIds.sort())
    .toEqual(expected);
  await holderPage.close();
});

test('a held save failure stays visible with Retry after navigating to another lesson', async ({
  context,
  page,
}) => {
  const holderPage = await context.newPage();
  await Promise.all([page.goto(`/#/learn/${SERVICE_LESSON}/5`), holderPage.goto('/#/about')]);
  const releaseLock = await holdProgressLock(holderPage);
  const allowProgressWrites = await failProgressWritesUntilReleased(page);
  await page.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await page.evaluate(
    ([lessonId, stepIndex]) => {
      window.__KUBEMOTION_TEST__?.goToLessonStep(lessonId, stepIndex);
    },
    [RESTART_LESSON, 0] as const,
  );
  await expect(page).toHaveURL(new RegExp(`${RESTART_LESSON}/0$`));
  await releaseLock();

  const alerts = page.getByTestId('progress-save-alerts');
  await expect(alerts.getByRole('alert')).toContainText('may be lost if you reload');
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson)
    .toMatchObject({
      [SERVICE_LESSON]: 'failed',
    });

  await allowProgressWrites();
  await alerts
    .getByRole('button', { name: /Retry saving How a Service routes to ready Pods/ })
    .click();

  await expect(alerts).toHaveCount(0);
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
    .toBe('saved');
  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);
  await expect
    .poll(async () => (await appProgress(holderPage)).completedLessonIds)
    .toEqual([SERVICE_LESSON]);
  await holderPage.close();
});

test('a held completion failure remains retryable after returning Home', async ({
  context,
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 320, height: 568 });
  }
  const holderPage = await context.newPage();
  await Promise.all([page.goto(`/#/learn/${SERVICE_LESSON}/5`), holderPage.goto('/#/about')]);
  const releaseLock = await holdProgressLock(holderPage);
  const allowProgressWrites = await failProgressWritesUntilReleased(page);
  const completion = page.getByTestId('lesson-completion-card');

  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(completion).toHaveAttribute('data-save-status', 'saving');
  await completion.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page).toHaveURL(/\/#\/$/);

  await releaseLock();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('may be lost if you reload');
  await expect(alert).toContainText('How a Service routes to ready Pods');
  const alertBox = await alert.boundingBox();
  const viewport = page.viewportSize();
  expect(alertBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (alertBox && viewport) {
    expect(alertBox.x).toBeGreaterThanOrEqual(0);
    expect(alertBox.x + alertBox.width).toBeLessThanOrEqual(viewport.width);
  }
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
    .toBe('failed');

  await allowProgressWrites();
  await page
    .getByRole('button', { name: /Retry saving How a Service routes to ready Pods/ })
    .click();

  await expect(alert).toHaveCount(0);
  await expect.poll(() => completedLessonIds(page)).toEqual([SERVICE_LESSON]);
  await expect
    .poll(async () => (await appProgress(page)).progressSaveStatusByLesson[SERVICE_LESSON])
    .toBe('saved');
  await expect
    .poll(async () => (await appProgress(holderPage)).completedLessonIds)
    .toEqual([SERVICE_LESSON]);
  await holderPage.close();
});

test('a later Reset invalidates a completion queued behind a held lock', async ({
  context,
  page,
}) => {
  const otherPage = await context.newPage();
  await Promise.all([page.goto(`/#/learn/${SERVICE_LESSON}/5`), otherPage.goto('/#/about')]);
  const releaseLock = await holdProgressLock(otherPage);
  const completion = page.getByTestId('lesson-completion-card');
  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect(completion).toHaveAttribute('data-save-status', 'saving');

  await page.evaluate(() => {
    void window.__KUBEMOTION_TEST__?.reset();
  });

  await expect(completion).toHaveAttribute('data-save-status', 'idle');
  await expect(completion).toContainText('Final step ready');
  await expect.poll(async () => (await appProgress(page)).completedLessonIds).toEqual([]);

  await releaseLock();

  await expect.poll(() => completedLessonIds(page)).toEqual([]);
  await expect
    .poll(() => appProgress(page))
    .toMatchObject({
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      stepIndex: 0,
    });
  await expect
    .poll(() => appProgress(otherPage))
    .toMatchObject({
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      stepIndex: 0,
    });
  await otherPage.close();
});

test('a storage failure keeps session intent and Retry converges both tabs', async ({
  context,
  page,
}) => {
  const otherPage = await context.newPage();
  await Promise.all([
    page.goto(`/#/learn/${SERVICE_LESSON}/5`),
    otherPage.goto(`/#/learn/${RESTART_LESSON}/9`),
  ]);
  await otherPage.getByRole('button', { name: 'Complete lesson', exact: true }).click();
  await expect.poll(() => completedLessonIds(otherPage)).toEqual([RESTART_LESSON]);
  await expect
    .poll(async () => (await appProgress(page)).completedLessonIds)
    .toEqual([RESTART_LESSON]);

  const allowProgressWrites = await failProgressWritesUntilReleased(page);
  const completion = page.getByTestId('lesson-completion-card');
  await completion.getByRole('button', { name: 'Complete lesson', exact: true }).click();

  await expect(completion).toHaveAttribute('data-save-status', 'failed');
  await expect(completion.getByRole('alert')).toContainText('kept for this session');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(completion.getByRole('link', { name: /Next lesson:/i })).toHaveCount(0);
  await expect
    .poll(() => appProgress(page))
    .toMatchObject({
      completedLessonIds: [RESTART_LESSON, SERVICE_LESSON],
      progressSaveStatusByLesson: { [SERVICE_LESSON]: 'failed' },
    });

  await allowProgressWrites();
  await completion.getByRole('button', { name: 'Retry save', exact: true }).click();

  await expect(completion).toHaveAttribute('data-save-status', 'saved');
  const expected = [RESTART_LESSON, SERVICE_LESSON].sort();
  await expect.poll(async () => (await completedLessonIds(page)).sort()).toEqual(expected);
  await expect
    .poll(async () => (await appProgress(page)).completedLessonIds.sort())
    .toEqual(expected);
  await expect
    .poll(async () => (await appProgress(otherPage)).completedLessonIds.sort())
    .toEqual(expected);
  await otherPage.close();
});
