import type { CSSProperties } from 'react';
import type { Locale } from '../../app/types';
import type { ActiveTeachingRoute, RouteSemantic, ViewMode } from '../../course/types';
import { colorToCss } from '../../renderer/design/palette';
import { relationLegendStyles } from '../../renderer/relations/RelationStyleCatalog';
import type { RelationSemantic } from '../../world/types';
import { lessonUi } from './copy';

type LegendSemantic =
  | 'data'
  | 'control'
  | 'scheduling'
  | 'node-runtime'
  | 'dns'
  | 'storage'
  | 'ownership'
  | 'placement'
  | 'endpoint'
  | 'configuration';

const routeLegendSemantic = (semantic: RouteSemantic): LegendSemantic => {
  switch (semantic) {
    case 'data-flow':
      return 'data';
    case 'node-runtime':
      return 'node-runtime';
    default:
      return semantic;
  }
};

const relationLegendSemantic = (semantic: RelationSemantic): LegendSemantic | undefined => {
  switch (semantic) {
    case 'ownership':
      return 'ownership';
    case 'placement':
      return 'placement';
    case 'control-observation':
      return 'control';
    case 'endpoint-membership':
    case 'selection':
      return 'endpoint';
    case 'data-flow':
      return 'data';
    case 'DNS-flow':
      return 'dns';
    case 'storage':
      return 'storage';
    case 'configuration':
      return 'configuration';
    default:
      return undefined;
  }
};

export function SceneLegend({
  locale,
  view,
  activeRoutes,
  relationSemantics,
}: {
  readonly locale: Locale;
  readonly view: ViewMode;
  readonly activeRoutes?: readonly ActiveTeachingRoute[];
  readonly relationSemantics?: readonly RelationSemantic[];
}) {
  const t = lessonUi(locale);
  const allItems = [
    ['data', t.applicationTraffic, relationLegendStyles.application],
    ['control', t.apiControl, relationLegendStyles.control],
    ['scheduling', t.scheduling, relationLegendStyles.scheduling],
    ['node-runtime', t.localNodeRuntime, relationLegendStyles.nodeRuntime],
    ['dns', t.dnsLookup, relationLegendStyles.dns],
    ['storage', t.storagePath, relationLegendStyles.storage],
    ['ownership', t.ownership, relationLegendStyles.ownership],
    ['placement', t.placementRelation, relationLegendStyles.placement],
    ['endpoint', t.endpointMembership, relationLegendStyles.endpointMembership],
    ['configuration', t.configurationLink, relationLegendStyles.configuration],
  ] as const;

  const activeSemantics: readonly LegendSemantic[] =
    activeRoutes && activeRoutes.length > 0
      ? [routeLegendSemantic(activeRoutes[0]!.semantic)]
      : Array.from(
          new Set(
            (relationSemantics ?? []).flatMap((semantic) => relationLegendSemantic(semantic) ?? []),
          ),
        ).slice(0, 2);
  const items = allItems.filter(([semantic]) => activeSemantics.includes(semantic));

  if (items.length === 0) return null;

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
