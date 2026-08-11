import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/pages/LearnPage';
import { useAppStore } from '../../src/state/appStore';

const focusedPodId = 'api-object:namespaced:shop:Pod:api-a-old';
const desktopMatchMedia = window.matchMedia;
const verifiedLessonHrefs = [
  '/learn/why-kubernetes-exists/0',
  '/learn/cluster-overview/0',
  '/learn/pod-and-container/0',
  '/learn/pod-and-placement/0',
  '/learn/deployment-replicaset-and-pods/0',
  '/learn/manifest-to-running-pod/0',
  '/learn/pending-and-scheduling/0',
  '/learn/container-restart-vs-pod-replacement/0',
  '/learn/labels-and-selectors/0',
  '/learn/service-routes-to-pods/0',
  '/learn/dns-and-service-discovery/0',
  '/learn/probes-and-rolling-update/0',
  '/learn/full-external-request/0',
  '/learn/hpa/0',
] as const;

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: ({
    onSelectEntity,
    step,
  }: {
    onSelectEntity: (id?: string) => void;
    step: { view: { entityStates: Record<string, { visible: boolean; labelMode: string }> } };
  }) => (
    <button
      type="button"
      data-visible-labels={
        Object.values(step.view.entityStates).filter(
          (state) => state.visible && state.labelMode !== 'none',
        ).length
      }
      onClick={() => onSelectEntity(focusedPodId)}
    >
      Select focused Pod
    </button>
  ),
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

describe('LearnPage lesson information architecture', () => {
  beforeEach(() => {
    window.matchMedia = desktopMatchMedia;
    localStorage.clear();
    useAppStore.setState({ locale: 'en', selectedEntityId: undefined });
  });

  it('keeps course navigation closed and enables boundary-aware navigation', () => {
    renderLesson();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /open course contents/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.queryByRole('dialog', { name: /Kubernetes Foundations/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the structured teaching contract and all ten direct-navigation steps', () => {
    renderLesson();
    expect(screen.getByTestId('teaching-step-heading')).toHaveTextContent(
      'What you are looking at',
    );
    expect(screen.getByTestId('teaching-what-changed')).toHaveTextContent('What is true now');
    expect(screen.getByTestId('teaching-why-it-happened')).toHaveTextContent('Why this happened');
    expect(screen.getByTestId('evidence-panel')).toBeVisible();
    expect(screen.getByTestId('teaching-takeaway')).toHaveTextContent('Remember this');
    expect(
      within(screen.getByLabelText('Scene legend')).getByText(/Kubernetes control command/i),
    ).toBeVisible();
    expect(
      within(screen.getByTestId('step-timeline')).getAllByRole('button', {
        name: /Go to step/i,
      }),
    ).toHaveLength(10);
  });

  it('lists all fourteen verified lessons in foundation order after the drawer is opened', () => {
    renderLesson();
    fireEvent.click(screen.getByRole('button', { name: /open course contents/i }));
    const drawer = screen.getByRole('dialog', { name: /Kubernetes Foundations/i });
    expect(drawer).toBeVisible();
    expect(within(drawer).getByText('14 verified lessons')).toBeVisible();
    expect(
      within(drawer)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(verifiedLessonHrefs);
  });

  it('keeps the inspector secondary until a scene object is selected', () => {
    renderLesson();
    expect(screen.getByTestId('world-inspector')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Select focused Pod/i }));
    expect(screen.getByTestId('world-inspector')).toHaveTextContent('synthetic-uid-old-a1');
    expect(screen.getByTestId('world-inspector')).toHaveTextContent('worker-a');
  });

  it('opens official sources on demand with safe link attributes', () => {
    renderLesson();
    fireEvent.click(screen.getByRole('button', { name: /^Sources/i }));
    const link = screen.getByRole('link', { name: /Pods/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('compiles the guided scene through the mobile grammar at the runtime breakpoint', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(max-width: 720px)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    renderLesson();
    expect(screen.getByRole('button', { name: 'Select focused Pod' })).toHaveAttribute(
      'data-visible-labels',
      '3',
    );
  });
});
