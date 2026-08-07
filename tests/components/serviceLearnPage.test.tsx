import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/pages/LearnPage';
import { useAppStore } from '../../src/state/appStore';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: () => <div data-testid="mock-scene-viewport" />,
}));

describe('LearnPage Service lesson routing summary', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ locale: 'en', selectedEntityId: undefined });
  });

  it('loads the lesson-specific scenario and exposes each labeled route hop accessibly', () => {
    render(
      <MemoryRouter initialEntries={['/learn/service-routes-to-pods/3']}>
        <Routes>
          <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('teaching-step-heading')).toHaveTextContent(
      'A request reaches one ready backend',
    );
    expect(
      within(screen.getByTestId('step-timeline')).getAllByRole('button', { name: /Go to step/i }),
    ).toHaveLength(6);
    const summary = document.querySelector('#scene-accessible-summary');
    expect(summary).toHaveTextContent('Request to ready api-a route');
    expect(summary).toHaveTextContent(
      'hop 1 (enter Service): source traffic-client at data-path, target api at data-path',
    );
    expect(summary).toHaveTextContent(
      'hop 2 (route to Ready api-a): source api at data-path, target api-a at data-path',
    );
  });
});
