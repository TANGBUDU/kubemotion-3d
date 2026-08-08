import type { CSSProperties } from 'react';
import type { Locale } from '../../app/types';
import type { ViewMode } from '../../course/types';
import { colorToCss } from '../../renderer/design/palette';
import { relationLegendStyles } from '../../renderer/relations/RelationStyleCatalog';
import { lessonUi } from './copy';

const semanticsByView: Readonly<Record<ViewMode, readonly string[]>> = {
  overview: ['control', 'scheduling', 'node-runtime'],
  logical: ['ownership', 'control'],
  placement: ['scheduling', 'node-runtime', 'ownership'],
  'control-flow': ['control', 'scheduling', 'node-runtime'],
  traffic: ['data', 'control'],
  storage: ['data', 'node-runtime', 'ownership'],
};

export function SceneLegend({
  locale,
  view,
}: {
  readonly locale: Locale;
  readonly view: ViewMode;
}) {
  const t = lessonUi(locale);
  const allItems = [
    ['data', t.applicationTraffic, relationLegendStyles.application],
    ['control', t.apiControl, relationLegendStyles.control],
    ['scheduling', t.scheduling, relationLegendStyles.scheduling],
    ['node-runtime', t.localNodeRuntime, relationLegendStyles.nodeRuntime],
    ['ownership', t.ownership, relationLegendStyles.ownership],
  ] as const;
  const activeSemantics = semanticsByView[view];
  const items = allItems.filter(([semantic]) => activeSemantics.includes(semantic));

  return (
    <aside className="scene-legend" aria-label={t.legend} data-view={view}>
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
