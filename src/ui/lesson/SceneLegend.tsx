import type { CSSProperties } from 'react';
import type { Locale } from '../../app/types';
import { colorToCss } from '../../renderer/design/palette';
import { relationLegendStyles } from '../../renderer/relations/RelationStyleCatalog';
import { lessonUi } from './copy';

export function SceneLegend({ locale }: { readonly locale: Locale }) {
  const t = lessonUi(locale);
  const items = [
    ['data', t.applicationTraffic, relationLegendStyles.application],
    ['control', t.apiControl, relationLegendStyles.control],
    ['scheduling', t.scheduling, relationLegendStyles.scheduling],
    ['ownership', t.ownership, relationLegendStyles.ownership],
  ] as const;

  return (
    <aside className="scene-legend" aria-label={t.legend}>
      <strong>{t.legend}</strong>
      <ul>
        {items.map(([semantic, label, style]) => (
          <li key={semantic}>
            <span
              className={`legend-line ${semantic}`}
              aria-hidden="true"
              data-width-css-px={style.widthCssPx}
              data-dashed={style.dashed}
              style={
                {
                  '--legend-color': colorToCss(style.color),
                  '--legend-width': `${style.widthCssPx}px`,
                  '--legend-line-style': style.dashed ? 'dashed' : 'solid',
                } as CSSProperties
              }
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
