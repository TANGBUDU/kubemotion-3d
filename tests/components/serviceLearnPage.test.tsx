import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/pages/LearnPage';
import { useAppStore } from '../../src/state/appStore';

const SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';

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
      'Request A reaches Ready endpoint api-a',
    );
    expect(
      within(screen.getByTestId('step-timeline')).getAllByRole('button', { name: /Go to step/i }),
    ).toHaveLength(6);
    const summary = document.querySelector('#scene-accessible-summary');
    expect(summary).toHaveTextContent('Request A · Ready api-a route');
    expect(summary).toHaveTextContent(
      'hop 1 (Request A enters Service): source traffic-client at network-out, target api at network-in',
    );
    expect(summary).toHaveTextContent(
      'hop 2 (select Ready api-a): source api at network-out, target api-a at network-in',
    );
  });

  it('shows the readiness-only step without an active request route', () => {
    render(
      <MemoryRouter initialEntries={['/learn/service-routes-to-pods/4']}>
        <Routes>
          <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('teaching-step-heading')).toHaveTextContent(
      'api-a remains listed but becomes NotReady',
    );
    expect(screen.getByTestId('teaching-takeaway')).toHaveTextContent(
      'Request A has already completed',
    );
    const evidence = screen.getByTestId('evidence-panel');
    expect(evidence).toHaveTextContent('api-a Endpoint conditions');
    expect(evidence).toHaveTextContent('ready=false · serving=false · terminating=false');
    expect(evidence).toHaveTextContent('ContainersReady');
    expect(evidence).toHaveTextContent('Pod Ready');
    expect(evidence).not.toHaveTextContent('Pod status');
    const summary = document.querySelector('#scene-accessible-summary');
    expect(summary).toHaveTextContent(
      'Pod api-a: phase Running; ContainersReady false; Ready false.',
    );
    expect(summary).not.toHaveTextContent('Pod status');
    expect(summary).toHaveTextContent(
      'api-a endpoint ready=false, serving=false, terminating=false',
    );
    expect(summary).toHaveTextContent('target api-c at network-in');

    act(() => useAppStore.getState().selectEntity(SLICE));
    const inspector = screen.getByTestId('world-inspector');
    expect(inspector).toHaveTextContent('api-a Endpoint conditions');
    expect(inspector).toHaveTextContent('ready=false · serving=false · terminating=false');
  });

  it('exposes Request B as a distinct later route to api-c', () => {
    render(
      <MemoryRouter initialEntries={['/learn/service-routes-to-pods/5']}>
        <Routes>
          <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('teaching-step-heading')).toHaveTextContent(
      'A later request selects another Ready endpoint',
    );
    const summary = document.querySelector('#scene-accessible-summary');
    expect(summary).toHaveTextContent('Request B · New request route');
    expect(summary).toHaveTextContent(
      'hop 1 (New request enters same Service): source traffic-client at network-out, target api at network-in',
    );
    expect(summary).toHaveTextContent(
      'hop 2 (select Ready api-c): source api at network-out, target api-c at network-in',
    );
  });
});
