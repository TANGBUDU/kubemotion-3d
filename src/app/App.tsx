import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';

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

export function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <Suspense fallback={<div className="route-loading">Loading KubeMotion…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:lessonId" element={<LearnPage />} />
          <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
