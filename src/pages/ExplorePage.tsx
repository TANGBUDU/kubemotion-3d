import { Box, Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ui } from '../app/i18n';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { lessonById, scenario, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { createExploreProjection } from '../course/exploreProjection';
import type { CompiledStep, ViewMode } from '../course/types';
import { useAppStore } from '../state/appStore';
import type { EntityStatus } from '../world/types';

const views: ViewMode[] = [
  'overview',
  'logical',
  'placement',
  'control-flow',
  'traffic',
  'storage',
];

const exploreCopy: Record<
  Locale,
  {
    panelTitle: string;
    filters: string;
    kind: string;
    namespace: string;
    status: string;
    inspectObject: string;
    chooseObject: string;
    betaNote: string;
    closeInspector: string;
    labels: string;
    sceneLabel: (view: string) => string;
    sceneCaption: (view: string) => string;
    viewLabels: Readonly<Record<ViewMode, string>>;
  }
> = {
  en: {
    panelTitle: 'GOLDEN WORLD',
    filters: 'FILTERS',
    kind: 'Kind',
    namespace: 'Namespace',
    status: 'Status',
    inspectObject: 'Inspect an object',
    chooseObject: 'Choose an object…',
    betaNote: 'Matches stay focused while one-hop owners and Nodes remain dimmed.',
    closeInspector: 'Close inspector',
    labels: 'Labels',
    sceneLabel: (view) => `Explore scene: ${view}`,
    sceneCaption: (view) => `SYNTHETIC SNAPSHOT · ${view.toUpperCase()} · BETA`,
    viewLabels: {
      overview: 'overview',
      logical: 'logical',
      placement: 'placement',
      storage: 'storage',
      'control-flow': 'control flow',
      traffic: 'traffic',
    },
  },
  ja: {
    panelTitle: 'ゴールデン WORLD',
    filters: 'フィルター',
    kind: 'Kind',
    namespace: 'Namespace',
    status: '状態',
    inspectObject: 'オブジェクトを調べる',
    chooseObject: 'オブジェクトを選択…',
    betaNote: '一致した対象を強調し、1 hop の owner と Node は薄く表示します。',
    closeInspector: 'インスペクターを閉じる',
    labels: 'ラベル',
    sceneLabel: (view) => `探索シーン: ${view}`,
    sceneCaption: (view) => `合成 SNAPSHOT · ${view.toUpperCase()} · ベータ`,
    viewLabels: {
      overview: '概要',
      logical: '論理',
      placement: '配置',
      storage: 'ストレージ',
      'control-flow': '制御フロー',
      traffic: 'トラフィック',
    },
  },
  'zh-CN': {
    panelTitle: '黄金 WORLD',
    filters: '筛选条件',
    kind: 'Kind',
    namespace: 'Namespace',
    status: '状态',
    inspectObject: '检查对象',
    chooseObject: '选择一个对象…',
    betaNote: '匹配对象保持突出显示，一跳范围内的 owner 与 Node 会变暗。',
    closeInspector: '关闭检查器',
    labels: '标签',
    sceneLabel: (view) => `探索场景：${view}`,
    sceneCaption: (view) => `合成 SNAPSHOT · ${view.toUpperCase()} · 测试版`,
    viewLabels: {
      overview: '总览',
      logical: '逻辑',
      placement: '位置',
      storage: '存储',
      'control-flow': '控制流',
      traffic: '流量',
    },
  },
};

export function ExplorePage() {
  const locale = useAppStore((state) => state.locale);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const activeView = views.includes(view) ? view : 'overview';
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const selected = useAppStore((state) => state.selectedEntityId);
  const selectEntity = useAppStore((state) => state.selectEntity);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const enterExplore = useAppStore((state) => state.enterExplore);
  const objectPickerRef = useRef<HTMLSelectElement>(null);
  const inspectorCloseRef = useRef<HTMLButtonElement>(null);
  const lesson = lessonById.get('container-restart-vs-pod-replacement');
  const compiled = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, scenario) : undefined),
    [lesson],
  );
  const world = compiled?.steps[0]?.world ?? scenario;
  const projection = useMemo(
    () => createExploreProjection(world, activeView, filters),
    [activeView, filters, world],
  );
  const sceneStep = useMemo<CompiledStep | undefined>(() => {
    const base = compiled?.steps[0];
    return base ? { ...base, view: projection, transition: { cues: [] } } : undefined;
  }, [compiled, projection]);
  const entity = selected ? world.entities[selected] : undefined;
  const t = ui(locale);
  const copy = exploreCopy[locale];
  const kinds = [...new Set(Object.values(world.entities).map((item) => item.kind))].sort();
  const namespaces = [
    ...new Set(
      Object.values(world.entities).flatMap((item) => (item.namespace ? [item.namespace] : [])),
    ),
  ].sort();
  const inspectableEntities = Object.values(world.entities).sort((left, right) =>
    `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`, locale),
  );
  useEffect(() => {
    enterExplore();
  }, [enterExplore]);
  useEffect(() => {
    if (activeView !== view) setView(activeView);
  }, [activeView, setView, view]);
  useEffect(() => {
    if (entity) inspectorCloseRef.current?.focus();
  }, [entity]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !entity) return;
      selectEntity(undefined);
      queueMicrotask(() => objectPickerRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entity, selectEntity]);
  const handleViewTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: ViewMode,
  ) => {
    const currentIndex = views.indexOf(current);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % views.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + views.length) % views.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = views.length - 1;
        break;
      default:
        return;
    }
    const next = views[nextIndex];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setView(next);
    document.getElementById(`explore-view-tab-${next}`)?.focus();
  };
  if (!lesson) throw new Error('Verified lesson is missing');
  if (!sceneStep) return null;
  return (
    <main className="explore-page">
      <aside className="explore-tools">
        <div className="panel-title">
          <Box size={17} aria-hidden="true" />
          {copy.panelTitle} <span className="beta-chip">{t.beta}</span>
        </div>
        <label>
          <span>
            <Search size={15} aria-hidden="true" />
            {t.search}
          </span>
          <input
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            placeholder="Pod, ReplicaSet, worker-a…"
          />
        </label>
        <label>
          <span>{copy.inspectObject}</span>
          <select
            ref={objectPickerRef}
            value={selected ?? ''}
            onChange={(event) => selectEntity(event.target.value || undefined)}
          >
            <option value="">{copy.chooseObject}</option>
            {inspectableEntities.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.kind} · {candidate.title[locale]}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-title">
          <Filter size={15} aria-hidden="true" /> {copy.filters}
        </div>
        <label>
          <span>{copy.kind}</span>
          <select
            value={filters.kind}
            onChange={(event) => setFilters({ kind: event.target.value })}
          >
            <option value="">{t.allKinds}</option>
            {kinds.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.namespace}</span>
          <select
            value={filters.namespace}
            onChange={(event) => setFilters({ namespace: event.target.value })}
          >
            <option value="">{t.allNamespaces}</option>
            {namespaces.map((namespace) => (
              <option key={namespace}>{namespace}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.status}</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value as EntityStatus | '' })}
          >
            <option value="">{t.allStatuses}</option>
            {['healthy', 'ready', 'pending', 'running', 'waiting', 'terminated'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <button
          className="secondary wide"
          type="button"
          onClick={() => setFilters({ query: '', kind: '', namespace: '', status: '' })}
        >
          {t.reset}
        </button>
        <p className="beta-note">{copy.betaNote}</p>
      </aside>
      <section className="explore-stage">
        <div className="view-tabs" role="tablist" aria-label={t.view}>
          {views.map((mode) => (
            <button
              id={`explore-view-tab-${mode}`}
              type="button"
              role="tab"
              aria-selected={activeView === mode}
              aria-controls="explore-scene-panel"
              tabIndex={activeView === mode ? 0 : -1}
              className={activeView === mode ? 'active' : ''}
              onClick={() => setView(mode)}
              onKeyDown={(event) => handleViewTabKeyDown(event, mode)}
              key={mode}
            >
              {copy.viewLabels[mode]}
            </button>
          ))}
        </div>
        <div
          id="explore-scene-panel"
          role="tabpanel"
          aria-labelledby={`explore-view-tab-${activeView}`}
          tabIndex={0}
        >
          <SceneViewport
            role="img"
            aria-label={copy.sceneLabel(copy.viewLabels[projection.view])}
            step={sceneStep}
            playback={{ stepKey: `explore-${activeView}`, playbackId: 0, transition: { cues: [] } }}
            selectedEntityId={selected}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectEntity={selectEntity}
          />
        </div>
        <div className="scene-caption">
          <span className="live-dot" /> {copy.sceneCaption(copy.viewLabels[projection.view])}
        </div>
      </section>
      {entity && (
        <aside
          className="inspector"
          role="dialog"
          aria-modal="false"
          aria-labelledby="explore-inspector-title"
        >
          <button
            ref={inspectorCloseRef}
            className="inspector-close"
            type="button"
            onClick={() => {
              selectEntity(undefined);
              queueMicrotask(() => objectPickerRef.current?.focus());
            }}
            aria-label={copy.closeInspector}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <div className="kind-chip">{entity.category}</div>
          <h1 id="explore-inspector-title">{entity.title[locale]}</h1>
          <p>{entity.summary[locale]}</p>
          <dl>
            <div>
              <dt>{copy.kind}</dt>
              <dd>{entity.kind}</dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd>
                <span className={`status ${entity.status}`} />
                {entity.status}
              </dd>
            </div>
            {entity.namespace && (
              <div>
                <dt>Namespace</dt>
                <dd>{entity.namespace}</dd>
              </div>
            )}
            {typeof entity.data.nodeName === 'string' && (
              <div>
                <dt>Node</dt>
                <dd>{entity.data.nodeName}</dd>
              </div>
            )}
          </dl>
          {entity.labels && (
            <section>
              <h2>{copy.labels}</h2>
              {Object.entries(entity.labels).map(([key, value]) => (
                <code key={key}>
                  {key}={value}
                </code>
              ))}
            </section>
          )}
          <section className="sources">
            <h2>{t.officialSources}</h2>
            {entity.sourceIds.map((id) => {
              const source = sources.get(id);
              return source ? (
                <a key={id} href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.title}
                </a>
              ) : null;
            })}
          </section>
        </aside>
      )}
    </main>
  );
}
