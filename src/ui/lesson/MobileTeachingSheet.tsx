import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Locale } from '../../app/types';
import { lessonUi } from './copy';

export interface MobileTeachingSheetProps {
  readonly locale: Locale;
  readonly stepLabel: string;
  readonly title: string;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly children: ReactNode;
}

export function MobileTeachingSheet({
  locale,
  stepLabel,
  title,
  expanded,
  onExpandedChange,
  children,
}: MobileTeachingSheetProps) {
  const t = lessonUi(locale);

  return (
    <aside
      className={`mobile-teaching-sheet ${expanded ? 'is-expanded' : 'is-collapsed'}`}
      aria-label={t.teaching}
      data-testid="teaching-sheet"
    >
      <button
        className="teaching-sheet-toggle"
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t.hideTeaching : t.showTeaching}
        aria-controls="teaching-sheet-body"
        onClick={() => onExpandedChange(!expanded)}
      >
        <span className="teaching-sheet-mobile-title">
          <small>{stepLabel}</small>
          <strong role="heading" aria-level={2}>
            {title}
          </strong>
        </span>
        {expanded ? (
          <ChevronDown size={18} aria-hidden="true" />
        ) : (
          <ChevronUp size={18} aria-hidden="true" />
        )}
      </button>
      <div id="teaching-sheet-body">{children}</div>
    </aside>
  );
}
