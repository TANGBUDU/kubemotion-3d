import { ArrowRight, Check, Compass, Home, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Locale } from '../../app/types';
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
  readonly nextLesson?: NextLessonLink | undefined;
  readonly onComplete: () => void;
  readonly onRestart: () => void;
}

export function LessonCompletionCard({
  locale,
  lessonTitle,
  completed,
  nextLesson,
  onComplete,
  onRestart,
}: LessonCompletionCardProps) {
  const t = lessonUi(locale);
  const primaryPath = nextLesson ? `/learn/${nextLesson.id}/0` : '/explore';
  const primaryLabel = nextLesson ? t.nextLesson(nextLesson.title) : t.exploreNext;

  return (
    <section
      className="lesson-completion-card"
      aria-labelledby="lesson-completion-title"
      data-testid="lesson-completion-card"
    >
      <div className="lesson-completion-heading">
        <span aria-hidden="true">{completed ? '✓' : '…'}</span>
        <div>
          <p>{completed ? t.lessonComplete : t.finalStepReady}</p>
          <h2 id="lesson-completion-title">{lessonTitle}</h2>
        </div>
      </div>
      <p className="lesson-completion-message" aria-live="polite">
        {completed ? t.completionMessage(lessonTitle) : t.completionPrompt(lessonTitle)}
      </p>
      <div className="lesson-completion-actions">
        {completed ? (
          <Link className="lesson-completion-primary" to={primaryPath}>
            {nextLesson ? (
              <ArrowRight size={16} aria-hidden="true" />
            ) : (
              <Compass size={16} aria-hidden="true" />
            )}
            <span>{primaryLabel}</span>
          </Link>
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
