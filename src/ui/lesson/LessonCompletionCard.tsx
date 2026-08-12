import {
  AlertTriangle,
  ArrowRight,
  Check,
  Compass,
  Home,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Locale } from '../../app/types';
import type { ProgressSaveStatus } from '../../state/appStore';
import '../../styles/lesson-completion.css';
import { lessonUi } from './copy';

export interface NextLessonLink {
  readonly id: string;
  readonly title: string;
}

export interface LessonCompletionCardProps {
  readonly locale: Locale;
  readonly lessonTitle: string;
  readonly completed: boolean;
  readonly saveStatus: ProgressSaveStatus;
  readonly nextLesson?: NextLessonLink | undefined;
  readonly onComplete: () => void;
  readonly onRetry: () => void;
  readonly onRestart: () => void;
}

export function LessonCompletionCard({
  locale,
  lessonTitle,
  completed,
  saveStatus,
  nextLesson,
  onComplete,
  onRetry,
  onRestart,
}: LessonCompletionCardProps) {
  const t = lessonUi(locale);
  const saving = completed && saveStatus === 'saving';
  const failed = completed && saveStatus === 'failed';
  const saved = completed && !saving && !failed;
  const primaryPath = nextLesson ? `/learn/${nextLesson.id}/0` : '/explore';
  const primaryLabel = nextLesson ? t.nextLesson(nextLesson.title) : t.exploreNext;
  const stateLabel = saving
    ? t.savingProgress
    : failed
      ? t.saveFailed
      : saved
        ? t.lessonComplete
        : t.finalStepReady;
  const message = saving
    ? t.savingMessage(lessonTitle)
    : failed
      ? t.saveFailedMessage
      : saved
        ? t.completionMessage(lessonTitle)
        : t.completionPrompt(lessonTitle);

  return (
    <section
      className="lesson-completion-card"
      aria-labelledby="lesson-completion-title"
      data-testid="lesson-completion-card"
      data-save-status={saveStatus}
    >
      <div className="lesson-completion-heading">
        <span aria-hidden="true">
          {saving ? (
            <LoaderCircle size={17} />
          ) : failed ? (
            <AlertTriangle size={17} />
          ) : saved ? (
            '✓'
          ) : (
            '…'
          )}
        </span>
        <div>
          <p>{stateLabel}</p>
          <h2 id="lesson-completion-title">{lessonTitle}</h2>
        </div>
      </div>
      <p
        className="lesson-completion-message"
        role={failed ? 'alert' : 'status'}
        aria-live={failed ? 'assertive' : 'polite'}
      >
        {message}
      </p>
      {saveStatus === 'saved' && (
        <p className="lesson-completion-save-status">
          <Check size={13} aria-hidden="true" />
          <span>{t.progressSaved}</span>
        </p>
      )}
      <div className="lesson-completion-actions">
        {saved ? (
          <Link className="lesson-completion-primary" to={primaryPath}>
            {nextLesson ? (
              <ArrowRight size={16} aria-hidden="true" />
            ) : (
              <Compass size={16} aria-hidden="true" />
            )}
            <span>{primaryLabel}</span>
          </Link>
        ) : failed ? (
          <button type="button" className="lesson-completion-primary" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>{t.retrySave}</span>
          </button>
        ) : saving ? (
          <button type="button" className="lesson-completion-primary" disabled>
            <LoaderCircle size={16} aria-hidden="true" />
            <span>{t.savingProgress}</span>
          </button>
        ) : (
          <button type="button" className="lesson-completion-primary" onClick={onComplete}>
            <Check size={16} aria-hidden="true" />
            <span>{t.completeLesson}</span>
          </button>
        )}
        <button type="button" onClick={onRestart}>
          <RotateCcw size={15} aria-hidden="true" />
          <span>{t.restartLesson}</span>
        </button>
        <Link to="/">
          <Home size={15} aria-hidden="true" />
          <span>{t.backHome}</span>
        </Link>
      </div>
    </section>
  );
}
