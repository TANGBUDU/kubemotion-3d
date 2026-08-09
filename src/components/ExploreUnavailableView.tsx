import { Compass } from 'lucide-react';
import type { Locale } from '../app/types';
import type { ViewMode } from '../course/types';

interface UnavailableCopy {
  readonly title: (view: string) => string;
  readonly detail: string;
  readonly action: string;
  readonly viewLabels: Readonly<Record<ViewMode, string>>;
}

const copyByLocale: Readonly<Record<Locale, UnavailableCopy>> = {
  en: {
    title: (view) => `${view} is unavailable for this snapshot.`,
    detail: 'This world has no Service/EndpointSlice or external traffic path.',
    action: 'Open the Service and EndpointSlice lesson to explore traffic.',
    viewLabels: {
      overview: 'Overview',
      logical: 'Logical',
      placement: 'Placement',
      'control-flow': 'Control Flow',
      traffic: 'Traffic',
      storage: 'Storage',
    },
  },
  ja: {
    title: (view) => `このスナップショットでは${view}を表示できません。`,
    detail: 'このワールドには Service/EndpointSlice も外部トラフィック経路もありません。',
    action: 'Service と EndpointSlice のレッスンでトラフィックを確認してください。',
    viewLabels: {
      overview: '全体像',
      logical: '論理',
      placement: '配置',
      'control-flow': '制御フロー',
      traffic: 'トラフィック',
      storage: 'ストレージ',
    },
  },
  'zh-CN': {
    title: (view) => `当前快照无法显示${view}。`,
    detail: '这个世界没有 Service/EndpointSlice，也没有外部流量路径。',
    action: '打开 Service 与 EndpointSlice 课程查看请求路径。',
    viewLabels: {
      overview: '总览',
      logical: '逻辑',
      placement: '位置',
      'control-flow': '控制流',
      traffic: '流量',
      storage: '存储',
    },
  },
};

/**
 * Shown in Explore when the current snapshot cannot satisfy a view's teaching contract.
 *
 * Explore offers every view on one fixed world, so a missing topology is an expected state, not a
 * failure. Naming the missing topology keeps the strict contract visible instead of silently
 * drawing an unrelated projection.
 */
export function ExploreUnavailableView({
  view,
  locale,
}: {
  readonly view: ViewMode;
  readonly locale: Locale;
}) {
  const copy = copyByLocale[locale];
  const viewLabel = copy.viewLabels[view];

  return (
    <div className="explore-unavailable" data-testid="explore-unavailable-view" data-view={view}>
      <Compass size={28} aria-hidden="true" />
      <p className="explore-unavailable-title">{copy.title(viewLabel)}</p>
      <p className="explore-unavailable-detail">{copy.detail}</p>
      <a className="explore-unavailable-action" href="#/learn/service-routes-to-pods/0">
        {copy.action}
      </a>
    </div>
  );
}
