import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Locale } from '../../app/types';
import { useAppStore } from '../../state/appStore';
import { lessonUi } from './copy';

export interface StepTimelineProps {
  readonly lessonId: string;
  readonly locale: Locale;
  readonly titles: readonly string[];
  readonly currentStep: number;
  readonly onStepChange: (step: number) => void;
}

export function StepTimeline({
  lessonId,
  locale,
  titles,
  currentStep,
  onStepChange,
}: StepTimelineProps) {
  const t = lessonUi(locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const reducedMotionRef = useRef(reducedMotion);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const positionActiveStep = () => {
      const activeStep = activeStepRef.current;
      if (!activeStep) return;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeStep.getBoundingClientRect();
      const inlinePadding = 8;
      const visibleLeft = containerRect.left + inlinePadding;
      const visibleRight = containerRect.right - inlinePadding;
      let delta = 0;

      if (activeRect.left < visibleLeft) delta = activeRect.left - visibleLeft;
      else if (activeRect.right > visibleRight) delta = activeRect.right - visibleRight;
      if (Math.abs(delta) < 1) return;

      const maximum = Math.max(0, container.scrollWidth - container.clientWidth);
      const left = Math.max(0, Math.min(maximum, container.scrollLeft + delta));
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ left, behavior: reducedMotionRef.current ? 'auto' : 'smooth' });
      } else {
        container.scrollLeft = left;
      }
    };

    positionActiveStep();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(positionActiveStep);
    resizeObserver?.observe(container);
    window.addEventListener('resize', positionActiveStep);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', positionActiveStep);
    };
  }, [currentStep, lessonId]);

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
      <div className="timeline-scroll" ref={scrollRef}>
        <ol>
          {titles.map((title, index) => (
            <li key={`${lessonId}:${index}`}>
              <button
                ref={index === currentStep ? activeStepRef : undefined}
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
