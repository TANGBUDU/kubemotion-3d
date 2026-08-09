import { Compass } from 'lucide-react';
import type { Locale } from '../app/types';
import type { LayoutContractError } from '../renderer/layouts/LayoutContractError';

interface UnavailableCopy {
  readonly title: string;
  readonly detail: string;
  readonly guidance: string;
  readonly trafficLesson: string;
}

const copyByLocale: Readonly<Record<Locale, UnavailableCopy>> = {
  en: {
    title: 'This view is unavailable for the current snapshot or filters.',
    detail: 'The selected objects do not provide the topology required by this view.',
    guidance: 'Reset filters or open the related guided lesson.',
    trafficLesson: 'Open the Service and EndpointSlice lesson.',
  },
  ja: {
    title: '現在のスナップショットまたはフィルターでは、このビューを表示できません。',
    detail: '選択中のオブジェクトだけでは、このビューに必要なトポロジーが揃っていません。',
    guidance: 'フィルターをリセットするか、関連するガイドレッスンを開いてください。',
    trafficLesson: 'Service と EndpointSlice のレッスンを開く。',
  },
  'zh-CN': {
    title: '当前快照或筛选条件无法组成这个视图。',
    detail: '当前可见对象不具备该视图所需的完整拓扑。',
    guidance: '请重置筛选条件，或打开相关的引导课程。',
    trafficLesson: '打开 Service 与 EndpointSlice 课程。',
  },
};

/**
 * Shown in Explore when the current snapshot cannot satisfy a view's teaching contract.
 *
 * Explore offers every view on one filtered snapshot, so an incomplete topology is an expected
 * state, not a failure. The structured error keeps the strict contract inspectable without
 * assuming whether the world or the active filters removed the required objects.
 */
export function ExploreUnavailableView({
  error,
  locale,
}: {
  readonly error: LayoutContractError;
  readonly locale: Locale;
}) {
  const copy = copyByLocale[locale];
  const issueCodes = error.issues.map((issue) => issue.code).join(' ');

  return (
    <div
      className="explore-unavailable"
      data-testid="explore-unavailable-view"
      data-view={error.view}
      data-scenario-id={error.scenarioId}
      data-layout-issues={issueCodes}
    >
      <Compass size={28} aria-hidden="true" />
      <p className="explore-unavailable-title">{copy.title}</p>
      <p className="explore-unavailable-detail">{copy.detail}</p>
      <p className="explore-unavailable-detail">{copy.guidance}</p>
      {error.view === 'traffic' ? (
        <a className="explore-unavailable-action" href="#/learn/service-routes-to-pods/0">
          {copy.trafficLesson}
        </a>
      ) : null}
    </div>
  );
}
