import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { Locale } from '../../app/types';
import '../../styles/lesson-completion.css';
import { lessonUi } from './copy';

export interface FailedLessonSave {
  readonly id: string;
  readonly title: string;
}

export interface ProgressSaveAlertsProps {
  readonly locale: Locale;
  readonly failures: readonly FailedLessonSave[];
  readonly onRetry: (lessonId: string) => void;
}

export function ProgressSaveAlerts({ locale, failures, onRetry }: ProgressSaveAlertsProps) {
  const t = lessonUi(locale);
  if (failures.length === 0) return null;

  return (
    <div className="lesson-progress-save-alerts" data-testid="progress-save-alerts">
      {failures.map((failure) => (
        <div className="lesson-progress-save-alert" role="alert" key={failure.id}>
          <AlertTriangle size={17} aria-hidden="true" />
          <p>{t.backgroundSaveFailed(failure.title)}</p>
          <button
            type="button"
            aria-label={t.retrySaveFor(failure.title)}
            onClick={() => onRetry(failure.id)}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>{t.retrySave}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
