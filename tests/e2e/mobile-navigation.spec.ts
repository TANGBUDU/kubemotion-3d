import { expect, test } from '@playwright/test';

const DESTINATIONS = ['learn', 'stories', 'explore', 'about'] as const;

/**
 * The compact header hides the inline nav. Before the disclosure button existed it hid it with
 * nothing in its place, which stranded Explore and About on every viewport under 820px.
 */
test('compact header keeps every destination reachable', async ({ page }, testInfo) => {
  test.skip(
    (testInfo.project.use.viewport?.width ?? 0) > 820,
    'The disclosure menu only replaces the inline nav on compact viewports',
  );

  await page.goto('/#/');
  const toggle = page.getByRole('button', { name: /open menu/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  const nav = page.getByRole('navigation', { name: /primary navigation/i });
  await expect(nav).toBeVisible();
  for (const destination of DESTINATIONS) {
    await expect(nav.locator(`a[href="#/${destination}"]`)).toBeVisible();
  }

  // The panel covers the live scene, so it must be opaque enough to read and must close on Escape.
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('choosing a destination closes the compact menu', async ({ page }, testInfo) => {
  test.skip(
    (testInfo.project.use.viewport?.width ?? 0) > 820,
    'The disclosure menu only replaces the inline nav on compact viewports',
  );

  await page.goto('/#/');
  await page.getByRole('button', { name: /open menu/i }).click();
  const nav = page.getByRole('navigation', { name: /primary navigation/i });
  await nav.locator('a[href="#/about"]').click();

  await expect(page).toHaveURL(/#\/about$/);
  await expect(nav).toBeHidden();
});
