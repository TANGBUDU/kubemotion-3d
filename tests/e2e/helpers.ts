import { expect, type Page } from '@playwright/test';

export const GOLDEN_LESSON = 'container-restart-vs-pod-replacement';
export const SERVICE_LESSON = 'service-routes-to-pods';

export const STEP_TITLES = [
  'What you are looking at',
  'Establish the healthy baseline',
  'The Container process exits',
  'kubelet restarts the Container in the same Pod',
  'Intentionally delete the Pod',
  'ReplicaSet controller restores the missing replica',
  'The new Pod is Pending and unscheduled',
  'Scheduler binds the Pod to worker-c',
  'kubelet starts the Container and readiness returns',
  'Compare the two outcomes',
] as const;

export const SERVICE_STEP_TITLES = [
  'Identify the traffic objects',
  'The Service stays stable',
  'EndpointSlice lists eligible backends',
  'Request A reaches Ready endpoint api-a',
  'api-a remains listed but becomes NotReady',
  'A later request selects another Ready endpoint',
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
  await expect(page.getByTestId('teaching-step-heading')).toContainText(title);
  if (stepIndex === STEP_TITLES.length - 1) {
    await expect(page.getByTestId('comparison-panel')).toBeVisible();
    return;
  }
  await waitForSceneIdle(page);
}

export async function gotoServiceStep(page: Page, stepIndex: number): Promise<void> {
  const title = SERVICE_STEP_TITLES[stepIndex];
  if (!title) throw new Error(`Unknown Service lesson step ${stepIndex}`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/learn/${SERVICE_LESSON}/${stepIndex}`);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(title);
  await waitForSceneIdle(page);
}

export async function revealEvidence(page: Page): Promise<void> {
  await page.getByTestId('evidence-panel').scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
}
