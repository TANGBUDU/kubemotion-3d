import { expect, test, type Page, type ViewportSize } from '@playwright/test';
import { GOLDEN_LESSON } from './helpers';

const mobileViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const satisfies readonly ViewportSize[];

const shellPaths = ['/', '/explore', '/about'] as const;

interface HeaderMetrics {
  readonly viewportWidth: number;
  readonly scrollWidth: number;
  readonly targets: readonly {
    readonly name: string;
    readonly left: number;
    readonly right: number;
    readonly width: number;
    readonly height: number;
  }[];
}

async function readHeaderMetrics(page: Page): Promise<HeaderMetrics> {
  return page.evaluate(() => {
    const targetSelectors = [
      ['brand', '.app-header .brand'],
      ['navigation', '.app-header nav a'],
      ['motion', '.app-header .motion-toggle'],
      ['language', '.app-header #locale'],
      ['reset', '.app-header .icon-button'],
    ] as const;
    const targets = targetSelectors.flatMap(([name, selector]) =>
      [...document.querySelectorAll<HTMLElement>(selector)].map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          name: `${name}-${index}`,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        };
      }),
    );
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      targets,
    };
  });
}

test('mobile app header stays in-bounds with full-size touch targets', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile responsive gate');

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    for (const path of shellPaths) {
      await page.goto(`/#${path}`);
      await expect(page.getByTestId('app-header')).toBeVisible();

      const metrics = await readHeaderMetrics(page);
      expect(
        metrics.scrollWidth,
        `${path} must not overflow at ${viewport.width}px`,
      ).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.targets).not.toHaveLength(0);
      for (const target of metrics.targets) {
        expect(target.left, `${target.name} starts outside ${path}`).toBeGreaterThanOrEqual(-0.5);
        expect(target.right, `${target.name} ends outside ${path}`).toBeLessThanOrEqual(
          metrics.viewportWidth + 0.5,
        );
        expect(target.width, `${target.name} touch width`).toBeGreaterThanOrEqual(44);
        expect(target.height, `${target.name} touch height`).toBeGreaterThanOrEqual(44);
      }
    }

    await page.goto('/#/about');
    await expect(page.getByTestId('app-header')).toHaveScreenshot(
      `app-header-${viewport.width}x${viewport.height}.png`,
      { animations: 'disabled', caret: 'hide', scale: 'css' },
    );
  }
});

test('mobile Explore controls meet touch targets and view tabs rove by keyboard', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile Explore accessibility gate');

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/#/explore');
    const overview = page.getByRole('tab', { name: 'overview' });
    const logical = page.getByRole('tab', { name: 'logical' });
    const storage = page.getByRole('tab', { name: 'storage' });
    await expect(overview).toBeVisible();

    const metrics = await page.evaluate(() => {
      const targets = [
        ...document.querySelectorAll<HTMLElement>(
          '.explore-tools input, .explore-tools select, .explore-tools button, .view-tabs button',
        ),
      ]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: element.textContent?.trim() || element.tagName,
            width: box.width,
            height: box.height,
          };
        });
      return {
        targets,
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.targets).not.toHaveLength(0);
    for (const target of metrics.targets) {
      expect(target.width, `${target.name} touch width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.name} touch height`).toBeGreaterThanOrEqual(44);
    }

    await overview.focus();
    await expect(overview).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('ArrowRight');
    await expect(logical).toBeFocused();
    await expect(logical).toHaveAttribute('aria-selected', 'true');
    await expect(overview).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(storage).toBeFocused();
    await expect(storage).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(overview).toBeFocused();
    await expect(overview).toHaveAttribute('aria-selected', 'true');

    await page.waitForFunction(() => Boolean(window.__KUBEMOTION_TEST__));
    await page.evaluate(() =>
      window.__KUBEMOTION_TEST__?.selectEntity('api-object:namespaced:shop:Pod:api-a-old'),
    );
    const closeInspector = page.getByRole('button', { name: 'Close inspector' });
    await expect(closeInspector).toBeVisible();
    const closeSize = await closeInspector.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(closeSize.width).toBeGreaterThanOrEqual(44);
    expect(closeSize.height).toBeGreaterThanOrEqual(44);
  }
});

test('deep-linked active timeline scrolls nearest without moving page or focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile timeline gate');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto(`/#/learn/${GOLDEN_LESSON}/0`);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /viewport-fit=cover/,
    );
    await expect(page.locator('.lesson-stage-frame')).toBeVisible();

    const lessonLayout = await page.evaluate(() => {
      const readRect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      const targets = [
        ...document.querySelectorAll<HTMLElement>(
          '.lesson-header button, .lesson-language select, .step-timeline button',
        ),
      ]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        });
      return {
        viewportHeight: window.innerHeight,
        stage: readRect('.lesson-stage-frame'),
        sheet: readRect('.mobile-teaching-sheet'),
        timeline: readRect('.step-timeline'),
        targets,
      };
    });
    expect(lessonLayout.stage.bottom).toBeLessThanOrEqual(lessonLayout.sheet.top + 1);
    expect(lessonLayout.sheet.bottom).toBeLessThanOrEqual(lessonLayout.timeline.top + 1);
    expect(lessonLayout.timeline.bottom).toBeLessThanOrEqual(lessonLayout.viewportHeight + 0.5);
    expect(lessonLayout.targets).not.toHaveLength(0);
    for (const target of lessonLayout.targets) {
      expect(target.width, 'lesson touch width').toBeGreaterThanOrEqual(44);
      expect(target.height, 'lesson touch height').toBeGreaterThanOrEqual(44);
    }

    const replay = page.locator('.lesson-header-actions button').first();
    await replay.focus();
    await expect(replay).toBeFocused();

    await page.evaluate((lessonId) => {
      window.location.hash = `#/learn/${lessonId}/8`;
    }, GOLDEN_LESSON);
    await expect(page).toHaveURL(new RegExp(`${GOLDEN_LESSON}/8$`));
    await expect(page.getByTestId('teaching-step-heading')).toContainText(
      'kubelet starts the Container and readiness returns',
    );
    await expect(replay).toBeFocused();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const container = document.querySelector<HTMLElement>('.timeline-scroll');
          const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
          if (!container || !active) return null;
          const containerRect = container.getBoundingClientRect();
          const activeRect = active.getBoundingClientRect();
          return {
            activeVisible:
              activeRect.left >= containerRect.left - 0.5 &&
              activeRect.right <= containerRect.right + 0.5,
            pageScrollY: window.scrollY,
            scrollLeft: container.scrollLeft,
          };
        }),
      )
      .toMatchObject({ activeVisible: true, pageScrollY: 0 });

    const manualPosition = await page.locator('.timeline-scroll').evaluate((container) => {
      container.scrollLeft = 0;
      return container.scrollLeft;
    });
    const replayUrl = page.url();
    const replayHeading = page.getByTestId('teaching-step-heading');
    const headingText = await replayHeading.textContent();
    await expect(replay).toHaveAttribute('aria-label', 'Replay step');
    await replay.click();
    await page.waitForTimeout(150);
    await expect(page).toHaveURL(replayUrl);
    await expect(replayHeading).toHaveText(headingText ?? '');
    await expect(page.locator('.timeline-scroll')).toHaveJSProperty('scrollLeft', manualPosition);
  }
});
