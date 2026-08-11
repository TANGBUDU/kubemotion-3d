import { BookOpen, Crosshair, ExternalLink, MessageCircle } from 'lucide-react';
import type { Locale } from '../../app/types';
import type { ComponentExplanation } from '../../app/entityPresentation';
import type { EvidenceRow } from '../../course/types';
import { lessonUi } from './copy';
import { EvidencePanel } from './EvidencePanel';

export interface TeachingPanelProps {
  readonly locale: Locale;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly title: string;
  readonly narration: string;
  readonly focusHint: string;
  readonly whatChanged: string;
  readonly whyItHappened: string;
  readonly takeaway: string;
  readonly evidence: readonly EvidenceRow[];
  readonly component?: ComponentExplanation | undefined;
  readonly termCount: number;
  readonly sourceCount: number;
  readonly onOpenTerms: () => void;
  readonly onOpenSources: () => void;
}

export function TeachingPanel({
  locale,
  stepIndex,
  stepCount,
  title,
  narration,
  focusHint,
  whatChanged,
  whyItHappened,
  takeaway,
  evidence,
  component,
  termCount,
  sourceCount,
  onOpenTerms,
  onOpenSources,
}: TeachingPanelProps) {
  const t = lessonUi(locale);

  return (
    <div className="teaching-panel" data-testid="teaching-panel">
      <div className="teaching-step-heading" data-testid="teaching-step-heading">
        <span>{t.stepOf(stepIndex + 1, stepCount)}</span>
        <h2>{title}</h2>
      </div>
      <section className="teaching-plain-language" data-testid="teaching-plain-language">
        <div>
          <MessageCircle size={15} aria-hidden="true" />
          <h3>{t.plainLanguage}</h3>
        </div>
        <p>{narration}</p>
      </section>
      <section className="teaching-focus-hint" data-testid="teaching-focus-hint">
        <Crosshair size={15} aria-hidden="true" />
        <div>
          <span>{t.lookHere}</span>
          <strong>{focusHint}</strong>
        </div>
      </section>
      {component ? (
        <section className="component-explanation" data-testid="component-explanation">
          <div className="component-explanation__title">
            <span>{t.componentGuide}</span>
            <strong>{component.heading}</strong>
          </div>
          <dl>
            <div>
              <dt>{t.responsibility}</dt>
              <dd>{component.responsibility}</dd>
            </div>
            <div>
              <dt>{t.mechanism}</dt>
              <dd>{component.mechanism}</dd>
            </div>
            {component.notResponsible ? (
              <div>
                <dt>{t.notResponsible}</dt>
                <dd>{component.notResponsible}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <section
        className="teaching-section teaching-section-change"
        data-testid="teaching-what-changed"
      >
        <h3>{t.whatChanged}</h3>
        <p>{whatChanged}</p>
      </section>
      <section
        className="teaching-section teaching-section-why"
        data-testid="teaching-why-it-happened"
      >
        <h3>{t.whyItHappened}</h3>
        <p>{whyItHappened}</p>
      </section>
      <EvidencePanel rows={evidence} locale={locale} compact />
      <section className="teaching-takeaway" data-testid="teaching-takeaway">
        <h3>{t.takeaway}</h3>
        <p>{takeaway}</p>
      </section>
      <div className="teaching-panel-actions">
        <button type="button" onClick={onOpenTerms} disabled={termCount === 0}>
          <BookOpen size={15} aria-hidden="true" />
          {t.terms}
          {termCount > 0 && <span>{termCount}</span>}
        </button>
        <button type="button" onClick={onOpenSources} disabled={sourceCount === 0}>
          <ExternalLink size={15} aria-hidden="true" />
          {t.sources}
          {sourceCount > 0 && <span>{sourceCount}</span>}
        </button>
      </div>
    </div>
  );
}
