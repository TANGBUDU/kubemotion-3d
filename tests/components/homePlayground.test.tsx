import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomeShowcase } from '../../src/components/HomeShowcase';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: ({
    step,
    playback,
  }: {
    step: { lessonId: string; index: number };
    playback: { playbackId: number; transition: { cues: readonly unknown[] } };
  }) => (
    <div
      data-testid="playground-scene"
      data-lesson-id={step.lessonId}
      data-step-index={step.index}
      data-playback-id={playback.playbackId}
      data-cue-count={playback.transition.cues.length}
    />
  ),
}));

function renderPlayground(reducedMotion = false) {
  return render(
    <MemoryRouter>
      <HomeShowcase locale="en" reducedMotion={reducedMotion} />
    </MemoryRouter>,
  );
}

describe('persistent homepage Kubernetes playground', () => {
  it('switches the real scene between verified Request, restart, replacement, and scale stories', () => {
    renderPlayground();

    const overview = screen.getByRole('button', { name: 'Overview' });
    const request = screen.getByRole('button', { name: 'Request' });
    const restart = screen.getByRole('button', { name: 'Kill container' });
    const replace = screen.getByRole('button', { name: 'Delete Pod' });
    const scale = screen.getByRole('button', { name: 'Scale +' });
    const scene = screen.getByTestId('playground-scene');

    expect(overview).toHaveAttribute('aria-pressed', 'true');
    expect(scene).toHaveAttribute('data-lesson-id', 'manifest-to-running-pod');
    expect(scene).toHaveAttribute('data-step-index', '0');

    fireEvent.click(request);
    expect(request).toHaveAttribute('aria-pressed', 'true');
    expect(scene).toHaveAttribute('data-lesson-id', 'service-routes-to-pods');
    expect(scene).toHaveAttribute('data-step-index', '0');
    expect(screen.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
      'href',
      '/stories/internal-service-request/0',
    );

    fireEvent.click(restart);
    expect(restart).toHaveAttribute('aria-pressed', 'true');
    expect(scene).toHaveAttribute('data-lesson-id', 'container-restart-vs-pod-replacement');
    expect(scene).toHaveAttribute('data-step-index', '2');
    expect(screen.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
      'href',
      '/stories/container-restart-vs-pod-replacement/2',
    );

    fireEvent.click(replace);
    expect(replace).toHaveAttribute('aria-pressed', 'true');
    expect(scene).toHaveAttribute('data-step-index', '4');
    expect(screen.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
      'href',
      '/stories/container-restart-vs-pod-replacement/4',
    );

    fireEvent.click(scale);
    expect(scale).toHaveAttribute('aria-pressed', 'true');
    expect(scene).toHaveAttribute('data-lesson-id', 'hpa');
    expect(scene).toHaveAttribute('data-step-index', '0');
    expect(screen.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
      'href',
      '/stories/hpa-scale-out/0',
    );
  });

  it('turns autoplay into explicit beat-by-beat control for reduced motion', () => {
    renderPlayground(true);

    const scene = screen.getByTestId('playground-scene');
    expect(scene).toHaveAttribute('data-step-index', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Advance sequence' }));
    expect(scene).toHaveAttribute('data-step-index', '1');
  });
});
