import { BookOpen, ExternalLink, ScanSearch, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { Locale } from '../../app/types';
import type { GlossaryTerm, SourceEntry } from '../../course/types';
import { lessonUi } from './copy';
import { useDrawerFocus } from './useDrawerFocus';

export type DetailSection = 'inspector' | 'terms' | 'sources';

export interface InspectorFact {
  readonly label: string;
  readonly value: string;
}

export interface InspectorDrawerProps {
  readonly open: boolean;
  readonly locale: Locale;
  readonly activeSection: DetailSection;
  readonly facts: readonly InspectorFact[];
  readonly terms: readonly GlossaryTerm[];
  readonly sources: readonly SourceEntry[];
  readonly verifiedAt: string;
  readonly onSectionChange: (section: DetailSection) => void;
  readonly onClose: () => void;
}

export function InspectorDrawer({
  open,
  locale,
  activeSection,
  facts,
  terms,
  sources,
  verifiedAt,
  onSectionChange,
  onClose,
}: InspectorDrawerProps) {
  const t = lessonUi(locale);
  const drawerRef = useDrawerFocus(open, onClose, false);
  const tabs = [
    ['inspector', t.inspector, ScanSearch],
    ['terms', t.terms, BookOpen],
    ['sources', t.sources, ExternalLink],
  ] as const;
  const enabledTabs = tabs.filter(([id]) => id !== 'inspector' || facts.length > 0);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: DetailSection) => {
    const currentIndex = enabledTabs.findIndex(([id]) => id === current);
    if (currentIndex < 0) return;
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % enabledTabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }
    const next = enabledTabs[nextIndex];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    onSectionChange(next[0]);
    document.getElementById(`details-tab-${next[0]}`)?.focus();
  };

  return (
    <aside
      ref={drawerRef}
      className="lesson-drawer inspector-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="details-drawer-title"
      hidden={!open}
    >
      <div className="drawer-header">
        <div>
          <span>{t.details}</span>
          <h2 id="details-drawer-title">{tabs.find(([id]) => id === activeSection)?.[1]}</h2>
        </div>
        <button type="button" aria-label={t.closeDetails} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="details-tabs" role="tablist" aria-label={t.details}>
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            id={`details-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeSection === id}
            aria-controls={`details-panel-${id}`}
            tabIndex={activeSection === id ? 0 : -1}
            disabled={id === 'inspector' && facts.length === 0}
            onClick={() => onSectionChange(id)}
            onKeyDown={(event) => handleTabKeyDown(event, id)}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="details-drawer-body">
        {activeSection === 'inspector' && (
          <section
            id="details-panel-inspector"
            role="tabpanel"
            aria-labelledby="details-tab-inspector"
            data-testid="world-inspector"
          >
            {facts.length === 0 ? (
              <p className="drawer-empty">{t.noSelection}</p>
            ) : (
              <dl className="inspector-facts">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
        {activeSection === 'terms' && (
          <section id="details-panel-terms" role="tabpanel" aria-labelledby="details-tab-terms">
            {terms.length === 0 ? (
              <p className="drawer-empty">—</p>
            ) : (
              terms.map((term) => (
                <article className="drawer-term" key={term.id}>
                  <h3>{term.term[locale]}</h3>
                  <p>{term.definition[locale]}</p>
                </article>
              ))
            )}
          </section>
        )}
        {activeSection === 'sources' && (
          <section
            id="details-panel-sources"
            role="tabpanel"
            aria-labelledby="details-tab-sources"
            className="drawer-sources"
          >
            {sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer noopener">
                <span>{source.title}</span>
                <small>{source.authority}</small>
              </a>
            ))}
            <p>
              {t.conceptual}
              <small>Verified {verifiedAt}</small>
            </p>
          </section>
        )}
      </div>
    </aside>
  );
}
