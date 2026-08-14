from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text('utf-8')
    if old not in text:
        raise SystemExit(f'Missing expected fragment: {label} in {path}')
    path.write_text(text.replace(old, new, 1), 'utf-8')


# Keep the mobile icon-only Explain CTA accessible.
replace_once(
    Path('src/components/HomeShowcase.tsx'),
    '''            <Link
              className="showcase-learn-link"
              to={`/stories/${preset.storyId}/${compiledBeatIndex}`}
''',
    '''            <Link
              className="showcase-learn-link"
              aria-label={copy.explain}
              title={copy.explain}
              to={`/stories/${preset.storyId}/${compiledBeatIndex}`}
''',
    'mobile Explain CTA',
)

replace_once(
    Path('src/components/HomeShowcase.tsx'),
    '''      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      data-preset={presetId}
''',
    '''      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      data-preset={presetId}
      data-beat-index={beatIndex}
''',
    'showcase beat state',
)

# A visible kubelet needs its visible Node parent for the real layout contract.
lesson = Path('content/courses/kubernetes-foundations/lessons/container-restart-vs-pod-replacement.yaml')
text = lesson.read_text('utf-8')
start = text.index('  - id: container-restarted\n')
end = text.index('  - id: kubectl-delete-pod\n', start)
block = text[start:end]
old = '''        - selector: { byIds: [runtime-component:node:worker-a:Kubelet:kubelet] }
          visible: true
          emphasis: normal
          labelMode: full
'''
new = '''        - selector: { byIds: [infrastructure:cluster:global:Node:worker-a] }
          visible: true
          emphasis: normal
          labelMode: full
        - selector: { byIds: [runtime-component:node:worker-a:Kubelet:kubelet] }
          visible: true
          emphasis: normal
          labelMode: full
'''
if old not in block:
    raise SystemExit('Missing container-restarted kubelet rule')
block = block.replace(old, new, 1)
lesson.write_text(text[:start] + block + text[end:], 'utf-8')

# Put the live product demo at the top of the desktop hero instead of vertically centering it
# against the taller onboarding copy.
replace_once(
    Path('src/styles/award/02-hero.css'),
    '''  gap: clamp(34px, 4.5vw, 82px);
  align-items: center;
  max-width: 1720px;
''',
    '''  gap: clamp(34px, 4.5vw, 82px);
  align-items: start;
  max-width: 1720px;
''',
    'desktop hero alignment',
)

replace_once(
    Path('src/styles/award/03-showcase.css'),
    '''.home-showcase {
  position: relative;
  z-index: 2;
  min-width: 0;
  perspective: 1600px;
}
''',
    '''.home-showcase {
  position: sticky;
  z-index: 2;
  top: calc(var(--header-height) + 22px);
  align-self: start;
  min-width: 0;
  perspective: 1600px;
}
''',
    'desktop sticky showcase',
)

replace_once(
    Path('src/styles/award/05-responsive.css'),
    '''  .home-showcase {
    order: -1;
  }
''',
    '''  .home-showcase {
    position: relative;
    top: auto;
    order: -1;
  }
''',
    'tablet showcase reset',
)

# Strengthen browser QA: exercise the formerly failing kubelet beat, expose state deterministically,
# and reject any uncaught runtime error.
e2e = Path('tests/e2e/homePlayground.spec.ts')
text = e2e.read_text('utf-8')
old = "  const showcase = page.locator('.home-showcase');\n  const scenario = (name: string) => showcase.getByRole('button', { name, exact: true });\n"
new = "  const pageErrors: string[] = [];\n  page.on('pageerror', (error) => pageErrors.push(error.message));\n  const showcase = page.locator('.home-showcase');\n  const scenario = (name: string) => showcase.getByRole('button', { name, exact: true });\n"
if old not in text:
    raise SystemExit('Missing first E2E showcase setup')
text = text.replace(old, new, 1)

old = '''  await scenario('Kill container').click();
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/2',
  );

  await scenario('Delete Pod').click();
'''
new = '''  await scenario('Kill container').click();
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/2',
  );
  await showcase.locator('.showcase-timeline button').nth(1).click();
  await expect(showcase).toHaveAttribute('data-beat-index', '1');
  await expect(
    showcase.getByText('kubelet restarts the Container in the same Pod', { exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);

  await scenario('Delete Pod').click();
'''
if old not in text:
    raise SystemExit('Missing Kill container E2E block')
text = text.replace(old, new, 1)

old = '''  expect(hasPageOverflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground.png'), fullPage: false });
});
'''
new = '''  expect(hasPageOverflow).toBe(false);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground.png'), fullPage: false });
});
'''
if old not in text:
    raise SystemExit('Missing first E2E overflow block')
text = text.replace(old, new, 1)

old = '''  const showcase = page.locator('.home-showcase');
  await showcase.getByRole('button', { name: 'Kill container', exact: true }).click();
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();
  await expect(showcase.locator('.showcase-timeline button[aria-current="step"] span')).toHaveText('01');

  await showcase.getByRole('button', { name: 'Advance sequence' }).click();
  await expect(showcase.locator('.showcase-timeline button[aria-current="step"] span')).toHaveText('02');
'''
new = '''  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const showcase = page.locator('.home-showcase');
  await showcase.getByRole('button', { name: 'Kill container', exact: true }).click();
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();
  await expect(showcase).toHaveAttribute('data-beat-index', '0');

  await showcase.getByRole('button', { name: 'Advance sequence' }).click();
  await expect(showcase).toHaveAttribute('data-beat-index', '1');
  await expect(
    showcase.getByText('kubelet restarts the Container in the same Pod', { exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
'''
if old not in text:
    raise SystemExit('Missing reduced-motion E2E block')
text = text.replace(old, new, 1)
e2e.write_text(text, 'utf-8')
