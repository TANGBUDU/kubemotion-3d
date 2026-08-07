import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Target,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ui } from '../app/i18n';
import { SceneViewport } from '../components/SceneViewport';
import { course, glossaryById, lessonById, scenario, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import type { PlaybackRequest } from '../course/types';
import { useAppStore } from '../state/appStore';
import { getContainerData, getPodData, getReplicaSetData } from '../world';
import type { EntityId, WorldEntity } from '../world/types';

const GOLDEN_LESSON = 'container-restart-vs-pod-replacement';

function podForInspector(
  world: Readonly<Record<EntityId, WorldEntity>>,
  selected: EntityId | undefined,
  focused: EntityId | undefined,
): WorldEntity | undefined {
  const candidate = selected ? world[selected] : focused ? world[focused] : undefined;
  if (!candidate) return undefined;
  if (candidate.kind === 'Pod') return candidate;
  if (candidate.kind === 'Container' && typeof candidate.data.podId === 'string') {
    return world[candidate.data.podId];
  }
  return undefined;
}

export function LearnPage() {
  const params = useParams();
  const navigate = useNavigate();
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const selected = useAppStore((state) => state.selectedEntityId);
  const selectEntity = useAppStore((state) => state.selectEntity);
  const enterLesson = useAppStore((state) => state.enterLesson);
  const setLessonStep = useAppStore((state) => state.setLessonStep);
  const navCollapsed = useAppStore((state) => state.courseNavCollapsed);
  const explanationCollapsed = useAppStore((state) => state.inspectorCollapsed);
  const setNavCollapsed = useAppStore((state) => state.setCourseNavCollapsed);
  const setExplanationCollapsed = useAppStore((state) => state.setInspectorCollapsed);
  const lesson = params.lessonId ? lessonById.get(params.lessonId) : undefined;
  const compiled = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, scenario) : undefined),
    [lesson],
  );
  const stepIndex = Number(params.stepIndex ?? 0);
  const [playbackId, setPlaybackId] = useState(0);
  const [cameraResetId, setCameraResetId] = useState(0);
  const t = ui(locale);
  const valid = Boolean(
    lesson &&
    compiled &&
    Number.isInteger(stepIndex) &&
    stepIndex >= 0 &&
    stepIndex < lesson.steps.length,
  );

  const go = useCallback(
    (index: number) => {
      if (!lesson || index < 0 || index >= lesson.steps.length) return;
      selectEntity(undefined);
      setLessonStep(index);
      setPlaybackId((value) => value + 1);
      navigate(`/learn/${lesson.id}/${index}`);
    },
    [lesson, navigate, selectEntity, setLessonStep],
  );

  useEffect(() => {
    if (valid && lesson) enterLesson(lesson.id, stepIndex);
  }, [enterLesson, lesson, stepIndex, valid]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(stepIndex - 1);
      if (event.key === 'ArrowRight') go(stepIndex + 1);
      if (event.key.toLowerCase() === 'r') setPlaybackId((value) => value + 1);
      if (event.key === 'Escape') selectEntity(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, selectEntity, stepIndex]);

  if (!params.lessonId) return <Navigate to={`/learn/${GOLDEN_LESSON}/0`} replace />;
  if (!valid || !lesson || !compiled) return <Navigate to={`/learn/${GOLDEN_LESSON}/0`} replace />;
  const authoredStep = lesson.steps[stepIndex];
  const step = compiled.steps[stepIndex];
  if (!authoredStep || !step) return null;

  const playback: PlaybackRequest = {
    stepKey: `${lesson.id}:${step.stepId}`,
    playbackId,
    transition: step.transition,
  };
  const focusedId = Object.entries(step.view.entityStates).find(
    ([, state]) => state.inspectorMode === 'expanded',
  )?.[0];
  const pod = podForInspector(step.world.entities, selected, focusedId);
  const podData = pod ? getPodData(pod) : undefined;
  const container = pod
    ? Object.values(step.world.entities).find(
        (entity) => entity.kind === 'Container' && entity.data.podId === pod.id,
      )
    : undefined;
  const containerData = container ? getContainerData(container) : undefined;
  const owner = pod
    ? Object.values(step.world.relations).find(
        (relation) => relation.type === 'owns' && relation.to === pod.id,
      )
    : undefined;
  const ownerEntity = owner ? step.world.entities[owner.from] : undefined;
  const replicaSet = Object.values(step.world.entities).find(
    (entity) => entity.kind === 'ReplicaSet',
  );
  const replicaCounts = replicaSet ? getReplicaSetData(replicaSet) : undefined;

  return (
    <main
      className={`learn-page ${navCollapsed ? 'nav-collapsed' : ''} ${explanationCollapsed ? 'explanation-collapsed' : ''}`}
    >
      <aside className="course-nav" aria-label="Verified lessons">
        <div className="panel-title">
          <BookOpen size={17} />
          <span>{course.title[locale]}</span>
        </div>
        <ol>
          {course.lessons
            .filter((entry) => entry.status === 'available')
            .map((entry, index) => (
              <li key={entry.id} className={entry.id === lesson.id ? 'current' : ''}>
                <Link to={`/learn/${entry.id}/0`}>
                  <span>{index + 1}</span>
                  <span>
                    {entry.title[locale]}
                    <small>{entry.estimatedMinutes} min · verified</small>
                  </span>
                </Link>
              </li>
            ))}
        </ol>
        <div className="planned-note">1 verified lesson · {course.lessons.length - 1} planned</div>
      </aside>

      <section className="learn-stage">
        <div className="view-badge">{step.view.view.replace('-', ' ').toUpperCase()}</div>
        {replicaCounts && (
          <div
            className="world-fact-strip"
            data-testid="replica-counts"
            data-world-revision={step.world.revision}
          >
            <strong>ReplicaSet</strong>
            <span>Desired {replicaCounts.desiredReplicas}</span>
            <span>Current {replicaCounts.currentReplicas}</span>
            <span>Ready {replicaCounts.readyReplicas}</span>
          </div>
        )}
        <button
          className="panel-toggle left"
          onClick={() => setNavCollapsed(!navCollapsed)}
          aria-label={navCollapsed ? t.expandLessons : t.collapseLessons}
        >
          {navCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          className="panel-toggle right"
          onClick={() => setExplanationCollapsed(!explanationCollapsed)}
          aria-label={explanationCollapsed ? t.expandExplanation : t.collapseExplanation}
        >
          {explanationCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
        </button>
        <SceneViewport
          key={`lesson-${lesson.id}`}
          step={step}
          playback={playback}
          selectedEntityId={selected}
          locale={locale}
          reducedMotion={reducedMotion}
          cameraResetId={cameraResetId}
          onSelectEntity={selectEntity}
        />

        {step.view.comparison && (
          <section className="comparison-panel" data-testid="comparison-panel">
            <h2>{step.view.comparison.title[locale]}</h2>
            <div className="comparison-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Container restart</th>
                    <th>Pod replacement</th>
                  </tr>
                </thead>
                <tbody>
                  {step.view.comparison.rows.map((row) => (
                    <tr key={row.property.en}>
                      <th>{row.property[locale]}</th>
                      <td>{row.containerRestart}</td>
                      <td>{row.podReplacement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <label className="mobile-step-select">
          <span>{t.step}</span>
          <select value={stepIndex} onChange={(event) => go(Number(event.target.value))}>
            {lesson.steps.map((item, index) => (
              <option value={index} key={item.id}>
                {index + 1}. {item.title[locale]}
              </option>
            ))}
          </select>
        </label>

        <div className="lesson-controls" aria-label="Lesson playback controls">
          <button
            aria-label={t.previous}
            onClick={() => go(stepIndex - 1)}
            disabled={stepIndex === 0}
          >
            <ChevronLeft size={18} /> <span>{t.previous}</span>
          </button>
          <div className="step-progress">
            <span>
              {stepIndex + 1} / {lesson.steps.length}
            </span>
            <div>
              {lesson.steps.map((item, index) => (
                <i key={item.id} className={index <= stepIndex ? 'done' : ''} />
              ))}
            </div>
          </div>
          <button aria-label={t.replay} onClick={() => setPlaybackId((value) => value + 1)}>
            <Play size={16} /> <span>{t.replay}</span>
          </button>
          <button aria-label={t.resetCamera} onClick={() => setCameraResetId((value) => value + 1)}>
            <Camera size={16} /> <span>{t.resetCamera}</span>
          </button>
          <button
            className="primary"
            aria-label={t.next}
            onClick={() => go(stepIndex + 1)}
            disabled={stepIndex === lesson.steps.length - 1}
          >
            <span>{t.next}</span> <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <aside className="narration-panel">
        <div className="step-kicker">VERIFIED LESSON · STEP {stepIndex + 1}</div>
        <h1>{authoredStep.title[locale]}</h1>
        <div className="objective">
          <Target size={17} />
          <div>
            <strong>{t.objective}</strong>
            <p>{authoredStep.learningOutcome[locale]}</p>
          </div>
        </div>
        <p className="narration">{authoredStep.narration[locale]}</p>

        {pod && podData && (
          <section className="world-inspector" data-testid="world-inspector">
            <h2>
              <Info size={14} /> {t.inspector}
            </h2>
            <dl>
              <div>
                <dt>Pod</dt>
                <dd>{pod.name}</dd>
              </div>
              <div>
                <dt>UID</dt>
                <dd>{podData.uid}</dd>
              </div>
              <div>
                <dt>Node</dt>
                <dd>{podData.nodeName ?? t.unscheduled}</dd>
              </div>
              <div>
                <dt>Phase</dt>
                <dd>{podData.phase}</dd>
              </div>
              {container && containerData && (
                <>
                  <div>
                    <dt>Container</dt>
                    <dd>{container.status}</dd>
                  </div>
                  <div>
                    <dt>Restarts</dt>
                    <dd>{containerData.restartCount}</dd>
                  </div>
                  <div>
                    <dt>Generation</dt>
                    <dd>{containerData.instanceGeneration}</dd>
                  </div>
                </>
              )}
              {ownerEntity && (
                <div>
                  <dt>Owner</dt>
                  <dd>{ownerEntity.name}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {authoredStep.introducesTerms.length > 0 && (
          <section>
            <h2>{t.terms}</h2>
            {authoredStep.introducesTerms.map((id) => {
              const term = glossaryById.get(id);
              return term ? (
                <div className="term" key={id}>
                  <strong>{term.term[locale]}</strong>
                  <p>{term.definition[locale]}</p>
                </div>
              ) : null;
            })}
          </section>
        )}
        <section className="sources">
          <h2>{t.officialSources}</h2>
          {authoredStep.sourceIds.map((id) => {
            const source = sources.get(id);
            return source ? (
              <a key={id} href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
                <span>{source.authority}</span>
              </a>
            ) : null;
          })}
          <small>Verified {lesson.verifiedAt} · conceptual, synthetic—not live telemetry</small>
        </section>
      </aside>
    </main>
  );
}
