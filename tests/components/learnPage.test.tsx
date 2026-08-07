import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/pages/LearnPage';
import { useAppStore } from '../../src/state/appStore';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: () => <div data-testid="mock-scene" />,
}));

function renderLesson(path = '/learn/container-restart-vs-pod-replacement/0') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LearnPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ locale: 'en', selectedEntityId: undefined });
  });

  it('enables and disables navigation at lesson boundaries', () => {
    renderLesson();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('does not make planned lessons clickable', () => {
    renderLesson();
    expect(screen.queryByRole('link', { name: /Probes/i })).not.toBeInTheDocument();
  });

  it('adds safe attributes to official source links', () => {
    renderLesson();
    const link = screen.getByRole('link', { name: /Pods/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });
});
