import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { useAppStore } from '../state/appStore';
import { ProgressSaveAlerts } from '../ui/lesson/ProgressSaveAlerts';

const AboutPage = lazy(() =>
  import('../pages/AboutPage').then((module) => ({ default: module.AboutPage })),
);
const ExplorePage = lazy(() =>
  import('../pages/ExplorePage').then((module) => ({ default: module.ExplorePage })),
);
const HomePage = lazy(() =>
  import('../pages/HomePage').then((module) => ({ default: module.HomePage })),
);
const LearnPage = lazy(() =>
  import('../pages/LearnPage').then((module) => ({ default: module.LearnPage })),
);
const FlowStoriesPage = lazy(() =>
  import('../pages/FlowStoriesPage').then((module) => ({ default: module.FlowStoriesPage })),
);
const FlowStoryPage = lazy(() =>
  import('../pages/FlowStoryPage').then((module) => ({ default: module.FlowStoryPage })),
);

export function App() {
  const location = useLocation();
  const locale = useAppStore((state) => state.locale);
  const progressSaveStatusByLesson = useAppStore((state) => state.progressSaveStatusByLesson);
  const progressSaveMetadataByLesson = useAppStore((state) => state.progressSaveMetadataByLesson);
  const retryProgressSave = useAppStore((state) => state.retryProgressSave);
  const learnRoute = /^\/learn\/([^/]+)\/(\d+)$/.exec(location.pathname);
  const routeLessonId = learnRoute?.[1] ? decodeURIComponent(learnRoute[1]) : undefined;
  const routeStepIndex = Number(learnRoute?.[2]);
  const cardHandledFailureLessonId =
    routeLessonId &&
    routeStepIndex === progressSaveMetadataByLesson[routeLessonId]?.completionStepIndex
      ? routeLessonId
      : undefined;
  const backgroundSaveFailures = Object.entries(progressSaveStatusByLesson).flatMap(
    ([lessonId, status]) => {
      if (status !== 'failed' || lessonId === cardHandledFailureLessonId) return [];
      return [
        {
          id: lessonId,
          title: progressSaveMetadataByLesson[lessonId]?.title[locale] ?? lessonId,
        },
      ];
    },
  );

  return (
    <div className="app-shell">
      <AppHeader />
      <ProgressSaveAlerts
        locale={locale}
        failures={backgroundSaveFailures}
        onRetry={retryProgressSave}
      />
      <Suspense fallback={<div className="route-loading">Loading KubeMotion…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:lessonId" element={<LearnPage />} />
          <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
          <Route path="/stories" element={<FlowStoriesPage />} />
          <Route path="/stories/:storyId" element={<FlowStoryPage />} />
          <Route path="/stories/:storyId/:beatIndex" element={<FlowStoryPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
