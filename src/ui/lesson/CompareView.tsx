import type { Locale } from '../../app/types';
import type { ComparisonPanelModel } from '../../course/types';
import { lessonUi } from './copy';

export interface CompareViewProps {
  readonly model: ComparisonPanelModel;
  readonly locale: Locale;
}

export function CompareView({ model, locale }: CompareViewProps) {
  const t = lessonUi(locale);
  return (
    <section
      className="compare-view"
      data-testid="comparison-panel"
      aria-labelledby="compare-title"
    >
      <div className="compare-heading">
        <span>WORLD HISTORY</span>
        <h2 id="compare-title">{model.title[locale]}</h2>
      </div>
      <div className="compare-columns">
        <article className="compare-card restart-card">
          <div className="compare-mini restart-mini" aria-hidden="true">
            <span className="mini-pod">
              <i />
              <i />
            </span>
            <b>→</b>
            <span className="mini-pod">
              <i className="new-generation" />
              <i />
            </span>
          </div>
          <h3>{t.containerRestart}</h3>
          <dl>
            {model.rows.map((row) => (
              <div key={`restart:${row.property.en}`}>
                <dt>{row.property[locale]}</dt>
                <dd>{row.containerRestart[locale]}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="compare-card replacement-card">
          <div className="compare-mini replacement-mini" aria-hidden="true">
            <span className="mini-pod removed">
              <i />
            </span>
            <b>→</b>
            <span className="mini-pod created">
              <i />
            </span>
          </div>
          <h3>{t.podReplacement}</h3>
          <dl>
            {model.rows.map((row) => (
              <div key={`replacement:${row.property.en}`}>
                <dt>{row.property[locale]}</dt>
                <dd>{row.podReplacement[locale]}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}
