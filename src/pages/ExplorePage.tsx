import { Box, Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { ui } from '../app/i18n';
import { SceneViewport } from '../components/SceneViewport';
import { lessonById, scenario, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { createExploreProjection } from '../course/exploreProjection';
import type { CompiledStep, ViewMode } from '../course/types';
import { useAppStore } from '../state/appStore';
import type { EntityStatus } from '../world/types';

const views: ViewMode[] = ['overview', 'logical', 'placement', 'control-flow', 'traffic'];

export function ExplorePage() {
  const locale = useAppStore((state) => state.locale);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const selected = useAppStore((state) => state.selectedEntityId);
  const selectEntity = useAppStore((state) => state.selectEntity);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const enterExplore = useAppStore((state) => state.enterExplore);
  const lesson = lessonById.get('container-restart-vs-pod-replacement');
  const compiled = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, scenario) : undefined),
    [lesson],
  );
  const world = compiled?.steps[0]?.world ?? scenario;
  const projection = useMemo(
    () => createExploreProjection(world, view, filters),
    [filters, view, world],
  );
  const sceneStep = useMemo<CompiledStep | undefined>(() => {
    const base = compiled?.steps[0];
    return base ? { ...base, view: projection, transition: { cues: [] } } : undefined;
  }, [compiled, projection]);
  const entity = selected ? world.entities[selected] : undefined;
  const t = ui(locale);
  const kinds = [...new Set(Object.values(world.entities).map((item) => item.kind))].sort();
  const namespaces = [
    ...new Set(
      Object.values(world.entities).flatMap((item) => (item.namespace ? [item.namespace] : [])),
    ),
  ].sort();
  useEffect(() => enterExplore(), [enterExplore]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') selectEntity(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectEntity]);
  if (!lesson) throw new Error('Verified lesson is missing');
  if (!sceneStep) return null;
  return (
    <main className="explore-page">
      <aside className="explore-tools">
        <div className="panel-title">
          <Box size={17} />
          GOLDEN WORLD <span className="beta-chip">{t.beta}</span>
        </div>
        <label>
          <span>
            <Search size={15} />
            {t.search}
          </span>
          <input
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            placeholder="Pod, ReplicaSet, worker-a…"
          />
        </label>
        <div className="filter-title">
          <Filter size={15} /> FILTERS
        </div>
        <label>
          <span>Kind</span>
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
          <span>Namespace</span>
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
          <span>Status</span>
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
          onClick={() => setFilters({ query: '', kind: '', namespace: '', status: '' })}
        >
          {t.reset}
        </button>
        <p className="beta-note">
          Matches stay focused while one-hop owners and Nodes remain dimmed.
        </p>
      </aside>
      <section className="explore-stage">
        <div className="view-tabs" role="tablist" aria-label={t.view}>
          {views.map((mode) => (
            <button
              role="tab"
              aria-selected={view === mode}
              className={view === mode ? 'active' : ''}
              onClick={() => setView(mode)}
              key={mode}
            >
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>
        <SceneViewport
          step={sceneStep}
          playback={{ stepKey: `explore-${view}`, playbackId: 0, transition: { cues: [] } }}
          selectedEntityId={selected}
          locale={locale}
          reducedMotion={reducedMotion}
          onSelectEntity={selectEntity}
        />
        <div className="scene-caption">
          <span className="live-dot" /> SYNTHETIC SNAPSHOT · {projection.view.toUpperCase()} · BETA
        </div>
      </section>
      {entity && (
        <aside className="inspector">
          <button
            className="inspector-close"
            onClick={() => selectEntity(undefined)}
            aria-label="Close inspector"
          >
            <X size={18} />
          </button>
          <div className="kind-chip">{entity.category}</div>
          <h1>{entity.title[locale]}</h1>
          <p>{entity.summary[locale]}</p>
          <dl>
            <div>
              <dt>Kind</dt>
              <dd>{entity.kind}</dd>
            </div>
            <div>
              <dt>Status</dt>
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
              <h2>Labels</h2>
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
