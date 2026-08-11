import { Camera, Home, Languages, List, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Locale } from '../../app/types';
import { lessonUi } from './copy';

export interface LessonHeaderProps {
  readonly chapter: string;
  readonly lessonTitle: string;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly locale: Locale;
  readonly courseOpen: boolean;
  readonly canResetCamera: boolean;
  readonly onOpenCourse: () => void;
  readonly onReplay: () => void;
  readonly onResetCamera: () => void;
  readonly onLocaleChange: (locale: Locale) => void;
}

export function LessonHeader({
  chapter,
  lessonTitle,
  stepIndex,
  stepCount,
  locale,
  courseOpen,
  canResetCamera,
  onOpenCourse,
  onReplay,
  onResetCamera,
  onLocaleChange,
}: LessonHeaderProps) {
  const t = lessonUi(locale);
  const progress = ((stepIndex + 1) / stepCount) * 100;
  const isFinalStep = stepIndex === stepCount - 1;
  const replayLabel = isFinalStep ? t.restartLesson : t.replay;

  return (
    <header className="lesson-header">
      <div className="lesson-header-nav">
        <Link
          className="lesson-header-icon lesson-home-link"
          to="/"
          aria-label={t.backHome}
          title={t.backHome}
        >
          <Home size={18} aria-hidden="true" />
        </Link>
        <button
          className="lesson-header-icon course-trigger"
          type="button"
          aria-label={t.openCourse}
          aria-expanded={courseOpen}
          aria-controls="course-drawer"
          onClick={onOpenCourse}
        >
          <List size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="lesson-heading">
        <p>{chapter}</p>
        <h1>{lessonTitle}</h1>
      </div>
      <div className="lesson-progress" aria-label={t.stepOf(stepIndex + 1, stepCount)}>
        <span>{t.stepOf(stepIndex + 1, stepCount)}</span>
        <span className="lesson-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      </div>
      <div className="lesson-header-actions">
        <button type="button" aria-label={replayLabel} title={replayLabel} onClick={onReplay}>
          {isFinalStep ? (
            <RotateCcw size={17} aria-hidden="true" />
          ) : (
            <Play size={17} aria-hidden="true" />
          )}
        </button>
        {canResetCamera && (
          <button
            type="button"
            aria-label={t.resetCamera}
            title={t.resetCamera}
            onClick={onResetCamera}
          >
            <Camera size={18} aria-hidden="true" />
          </button>
        )}
        <label className="lesson-language">
          <Languages size={17} aria-hidden="true" />
          <span className="sr-only">{t.language}</span>
          <select
            aria-label={t.language}
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
          >
            <option value="en">EN</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">中文</option>
          </select>
        </label>
      </div>
    </header>
  );
}
