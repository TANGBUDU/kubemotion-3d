import type { ReactNode } from 'react';

export interface LessonShellProps {
  readonly header: ReactNode;
  readonly stage: ReactNode;
  readonly teaching: ReactNode;
  readonly timeline: ReactNode;
  readonly drawers?: ReactNode;
  readonly announcement: string;
  readonly comparisonActive?: boolean;
}

export function LessonShell({
  header,
  stage,
  teaching,
  timeline,
  drawers,
  announcement,
  comparisonActive = false,
}: LessonShellProps) {
  return (
    <main className="lesson-shell" data-comparison-active={comparisonActive || undefined}>
      {header}
      <div className="lesson-workspace">
        <section className="lesson-stage-frame">{stage}</section>
        {teaching}
      </div>
      {timeline}
      {drawers}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </main>
  );
}
