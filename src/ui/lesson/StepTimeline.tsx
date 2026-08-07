import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '../../app/types';
import { lessonUi } from './copy';

export interface StepTimelineProps {
  readonly locale: Locale;
  readonly titles: readonly string[];
  readonly currentStep: number;
  readonly onStepChange: (step: number) => void;
}

export function StepTimeline({ locale, titles, currentStep, onStepChange }: StepTimelineProps) {
  const t = lessonUi(locale);

  return (
    <nav className="step-timeline" aria-label={t.timeline} data-testid="step-timeline">
      <button
        className="timeline-edge-button"
        type="button"
        aria-label={t.previous}
        disabled={currentStep === 0}
        onClick={() => onStepChange(currentStep - 1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
        <span>{t.previous}</span>
      </button>
      <div className="timeline-scroll">
        <ol>
          {titles.map((title, index) => (
            <li key={`${index}:${title}`}>
              <button
                type="button"
                className={index < currentStep ? 'is-complete' : undefined}
                aria-current={index === currentStep ? 'step' : undefined}
                aria-label={t.goToStep(index + 1, title)}
                title={`${index + 1}. ${title}`}
                onClick={() => onStepChange(index)}
              >
                <span aria-hidden="true">{index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <button
        className="timeline-edge-button primary"
        type="button"
        aria-label={t.next}
        disabled={currentStep === titles.length - 1}
        onClick={() => onStepChange(currentStep + 1)}
      >
        <span>{t.next}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
