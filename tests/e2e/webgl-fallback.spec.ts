import { expect, test, type Page } from '@playwright/test';
import { GOLDEN_LESSON, STEP_TITLES } from './helpers';

async function installWebGLGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    let webglBlocked = true;
    const testWindow = window as unknown as Window & { __enableKubeMotionWebGL: () => void };
    testWindow.__enableKubeMotionWebGL = () => {
      webglBlocked = false;
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function patchedGetContext(
        this: HTMLCanvasElement,
        contextId: string,
        ...args: unknown[]
      ) {
        if (
          webglBlocked &&
          (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl')
        ) {
          return null;
        }
        return Reflect.apply(originalGetContext, this, [contextId, ...args]) as unknown;
      },
    });
  });
}

test('keeps the lesson usable and recovers after an explicit WebGL retry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installWebGLGate(page);

  await page.goto(`/#/learn/${GOLDEN_LESSON}/0`);

  await expect(page.getByTestId('teaching-step-heading')).toContainText(STEP_TITLES[0]);
  await expect(page.getByTestId('evidence-panel')).toBeVisible();
  const fallback = page.getByTestId('scene-renderer-fallback');
  await expect(fallback).toBeVisible();
  await expect(page.getByRole('alert', { name: '3D scene unavailable' })).toBeVisible();
  await expect(fallback).toContainText('The rest of this page remains available.');
  await expect(fallback).toBeFocused();
  await expect(page.locator('.scene-render-host canvas')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneControllerLifecycle()),
  ).toMatchObject({ created: 0, destroyed: 0, active: 0 });
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);

  await page.evaluate(() => {
    const testWindow = window as unknown as Window & { __enableKubeMotionWebGL: () => void };
    testWindow.__enableKubeMotionWebGL();
  });
  await fallback.getByRole('button', { name: 'Retry 3D scene' }).click();

  await expect(fallback).toHaveCount(0);
  const viewport = page.getByTestId('scene-viewport');
  await expect(viewport).toBeFocused();
  await expect(viewport).toHaveAttribute('role', 'img');
  await expect(viewport).toHaveAccessibleName('Interactive Kubernetes teaching scene');
  await expect(page.locator('.scene-render-host canvas')).toBeVisible();
  expect(
    await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneControllerLifecycle()),
  ).toMatchObject({ created: 1, destroyed: 0, active: 1, destroyedWithActiveListeners: 0 });
  await page.waitForFunction(() => {
    const diagnostics = window.__KUBEMOTION_TEST__?.getSceneDiagnostics();
    return diagnostics !== undefined && diagnostics.entityHandles > 0;
  });
  await expect(page.getByTestId('teaching-step-heading')).toContainText(STEP_TITLES[0]);
  await expect(page.getByTestId('evidence-panel')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('uses the comparison view without mounting a hidden WebGL fallback', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installWebGLGate(page);

  await page.goto(`/#/learn/${GOLDEN_LESSON}/9`);

  await expect(page.getByTestId('teaching-step-heading')).toContainText(STEP_TITLES[9]);
  await expect(page.getByTestId('comparison-panel')).toBeVisible();
  await expect(page.getByTestId('scene-viewport')).toHaveCount(0);
  await expect(page.getByTestId('scene-renderer-fallback')).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneControllerLifecycle()),
  ).toMatchObject({ created: 0, destroyed: 0, active: 0 });
  expect(pageErrors).toEqual([]);
});
