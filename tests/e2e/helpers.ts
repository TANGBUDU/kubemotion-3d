import { expect, type Page } from '@playwright/test';

export const GOLDEN_LESSON = 'container-restart-vs-pod-replacement';

export const STEP_TITLES = [
  'Establish the healthy identity',
  'The container process exits',
  'kubelet restarts the container in place',
  'The whole Pod is deleted',
  'The controller creates a new Pending Pod',
  'Scheduler assigns worker-c and kubelet starts it',
  'Compare the two factual histories',
] as const;

export async function waitForSceneIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const diagnostics = window.__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
        diagnostics.entityHandles > 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(120);
}

export async function gotoGoldenStep(page: Page, stepIndex: number): Promise<void> {
  const title = STEP_TITLES[stepIndex];
  if (!title) throw new Error(`Unknown golden lesson step ${stepIndex}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/learn/${GOLDEN_LESSON}/${stepIndex}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await waitForSceneIdle(page);
}
