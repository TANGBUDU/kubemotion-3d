import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../../src/pages/HomePage';
import { AboutPage } from '../../src/pages/AboutPage';
import { useAppStore } from '../../src/state/appStore';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: ({
    'aria-label': ariaLabel,
    step,
    playback,
  }: {
    'aria-label'?: string;
    step: { lessonId: string; index: number };
    playback: { playbackId: number; transition: { cues: readonly unknown[] } };
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-testid="scene-preview"
      data-lesson-id={step.lessonId}
      data-step-index={step.index}
      data-playback-id={playback.playbackId}
      data-cue-count={playback.transition.cues.length}
    />
  ),
}));

const availableLessonIds = [
  'why-kubernetes-exists',
  'cluster-overview',
  'pod-and-container',
  'pod-and-placement',
  'deployment-replicaset-and-pods',
  'manifest-to-running-pod',
  'pending-and-scheduling',
  'container-restart-vs-pod-replacement',
  'labels-and-selectors',
  'service-routes-to-pods',
  'dns-and-service-discovery',
  'probes-and-rolling-update',
  'full-external-request',
  'hpa',
] as const;

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<p>Explore</p>} />
        <Route path="/learn/:lessonId/:stepIndex" element={<p>Lesson</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomePage orientation and live showcase', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      locale: 'en',
      reducedMotion: false,
      orientationSeen: false,
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
    });
  });

  it('shows a verified 3D causal sequence immediately while preserving one beginner action', () => {
    renderHome();

    expect(screen.getByTestId('orientation-card')).toBeVisible();
    expect(screen.getByText('One app can run without Kubernetes.')).toBeVisible();
    expect(screen.getByText('Kubernetes keeps a declared result true over time.')).toBeVisible();
    expect(
      screen.getByText(
        'Every highlighted line has one job: request, control, scheduling, or local runtime.',
      ),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Start lesson' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/why-kubernetes-exists/0',
    );
    expect(screen.getByTestId('scene-preview')).toHaveAttribute(
      'data-lesson-id',
      'manifest-to-running-pod',
    );
    expect(screen.getByTestId('scene-preview')).toHaveAttribute('data-step-index', '0');
    expect(screen.getByTestId('scene-preview')).toHaveAttribute('data-playback-id', '1');
    expect(Number(screen.getByTestId('scene-preview').getAttribute('data-cue-count'))).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId('scene-preview')).toHaveAccessibleName(
      'Live 3D Kubernetes demonstration: Manifest to running Pod. kubectl submits desired state to the API Server',
    );
    expect(screen.getByRole('heading', { name: 'Manifest to running Pod' })).toBeVisible();
    expect(screen.getByText('kubectl submits desired state to the API Server')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause sequence' })).toBeVisible();
  });

  it('publishes eight first-class flow stories that deep-link to their first causal beat', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { name: /Trace complete Kubernetes causes/i }),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Open story' })).toHaveLength(8);
    const externalStory = document.querySelector('[data-flow-story-id="external-browser-request"]');
    const hpaStory = document.querySelector('[data-flow-story-id="hpa-scale-out"]');
    expect(externalStory?.querySelector('a')).toHaveAttribute(
      'href',
      '/stories/external-browser-request/0',
    );
    expect(hpaStory?.querySelector('a')).toHaveAttribute('href', '/stories/hpa-scale-out/0');
  });

  it('lets the viewer take control of the showreel from its beat rail', () => {
    renderHome();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Beat 3 \/ 8: A controller reconciles the replica deficit/i,
      }),
    );

    expect(screen.getByText('A controller reconciles the replica deficit')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resume sequence' })).toBeVisible();
    expect(screen.getByTestId('scene-preview')).toHaveAttribute('data-playback-id', '2');
  });

  it('remembers orientation when the learner starts the lesson', () => {
    renderHome();
    fireEvent.click(screen.getByRole('link', { name: 'Start lesson' }));

    expect(screen.getByText('Lesson')).toBeVisible();
    expect(useAppStore.getState().orientationSeen).toBe(true);
    expect(JSON.parse(localStorage.getItem('kubemotion:v1:preferences') ?? '{}')).toMatchObject({
      orientationSeen: true,
      localeExplicit: true,
    });
  });

  it('lets returning learners reopen and skip the orientation with focus restored', async () => {
    useAppStore.setState({ orientationSeen: true });
    renderHome();

    const reopen = screen.getByRole('button', { name: 'View orientation again' });
    expect(screen.queryByTestId('orientation-card')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start lesson' })).toHaveLength(1);

    fireEvent.click(reopen);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Three things to know/i })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue without review' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'View orientation again' })).toHaveFocus(),
    );
  });

  it('continues valid learner progress without replacing the cinematic homepage sequence', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 3,
    });
    const view = renderHome();

    expect(screen.getByRole('link', { name: 'Continue learning' })).toHaveAttribute(
      'href',
      '/learn/container-restart-vs-pod-replacement/3',
    );
    expect(screen.getByTestId('scene-preview')).toHaveAttribute(
      'data-lesson-id',
      'manifest-to-running-pod',
    );

    view.unmount();
    useAppStore.setState({ lessonId: 'planned-or-missing', stepIndex: 99 });
    renderHome();
    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/why-kubernetes-exists/0',
    );
  });

  it('starts the first unfinished Pod and Container lesson after its prerequisites are complete', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'cluster-overview',
      stepIndex: 4,
      completedLessonIds: ['why-kubernetes-exists', 'cluster-overview'],
    });

    renderHome();

    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/pod-and-container/0',
    );
    expect(screen.getByTestId('scene-preview')).toHaveAttribute(
      'data-lesson-id',
      'manifest-to-running-pod',
    );
  });

  it('changes the Home primary action to Explore after every available lesson is complete', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
      completedLessonIds: [...availableLessonIds],
    });

    renderHome();

    expect(screen.getByRole('link', { name: 'Explore completed lessons' })).toHaveAttribute(
      'href',
      '/explore',
    );
    expect(screen.queryByRole('link', { name: 'Continue learning' })).not.toBeInTheDocument();
    expect(screen.getByTestId('scene-preview')).toHaveAttribute(
      'data-lesson-id',
      'manifest-to-running-pod',
    );
  });

  it.each([
    [
      'en',
      'Live 3D Kubernetes demonstration: Manifest to running Pod. kubectl submits desired state to the API Server',
      'Manifest to running Pod',
      'kubectl submits desired state to the API Server',
    ],
    [
      'ja',
      'Kubernetes のライブ 3D デモ: マニフェストから実行中の Pod まで. kubectl が desired state を API Server に送信する',
      'マニフェストから実行中の Pod まで',
      'kubectl が desired state を API Server に送信する',
    ],
    [
      'zh-CN',
      'Kubernetes 实时 3D 演示: 从清单到运行中的 Pod. kubectl 向 API Server 提交期望状态',
      '从清单到运行中的 Pod',
      'kubectl 向 API Server 提交期望状态',
    ],
  ] as const)('localizes the %s live 3D showcase', (locale, ariaLabel, title, beatTitle) => {
    useAppStore.setState({ locale });
    renderHome();

    expect(screen.getByTestId('scene-preview')).toHaveAccessibleName(ariaLabel);
    expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.getByText(beatTitle)).toBeVisible();
  });

  it('localizes the three orientation concepts', () => {
    useAppStore.setState({ locale: 'zh-CN' });
    renderHome();

    expect(screen.getByText('只运行一个应用时，未必需要 Kubernetes。')).toBeVisible();
    expect(screen.getByText('Kubernetes 的价值是让你声明的结果长期自动成立。')).toBeVisible();
    expect(
      screen.getByText('每条高亮线只表达一种动作：请求、控制、调度或 Node 内执行。'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '开始课程' })).toBeVisible();
  });
});

describe('AboutPage roadmap', () => {
  it('follows manifest order and keeps available lessons before planned work', () => {
    useAppStore.setState({ locale: 'en' });
    const { container } = render(<AboutPage />);
    const rows = [...container.querySelectorAll('.roadmap-list > div')];

    expect(rows).toHaveLength(22);
    expect(rows.slice(0, 14).every((row) => row.classList.contains('available'))).toBe(true);
    expect(rows.slice(14).every((row) => row.classList.contains('planned'))).toBe(true);
    expect(rows[12]).toHaveTextContent('Complete external browser request');
    expect(rows[13]).toHaveTextContent('Horizontal Pod Autoscaling');
  });
});
