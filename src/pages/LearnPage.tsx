import { BookOpen, ChevronLeft, ChevronRight, Play, Target } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ui } from '../app/i18n';
import { SceneViewport } from '../components/SceneViewport';
import { course, glossaryById, lessonById, scenario, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { createClusterGraph } from '../domain/clusterGraph';
import { useAppStore } from '../state/appStore';

export function LearnPage() {
  const params = useParams();
  const navigate = useNavigate();
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const selected = useAppStore((state) => state.selectedEntityId);
  const selectEntity = useAppStore((state) => state.selectEntity);
  const enterLesson = useAppStore((state) => state.enterLesson);
  const setLessonStep = useAppStore((state) => state.setLessonStep);
  const graph = useMemo(() => createClusterGraph(scenario), []);
  const lesson = params.lessonId ? lessonById.get(params.lessonId) : undefined;
  const stepIndex = Number(params.stepIndex ?? 0);
  const [, setReplay] = useState(0);
  const t = ui(locale);

  const compiled = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, graph) : undefined),
    [graph, lesson],
  );
  const valid =
    lesson &&
    compiled &&
    Number.isInteger(stepIndex) &&
    stepIndex >= 0 &&
    stepIndex < lesson.steps.length;
  const go = useCallback(
    (index: number) => {
      if (!lesson || index < 0 || index >= lesson.steps.length) return;
      setLessonStep(index);
      navigate(`/learn/${lesson.id}/${index}`);
    },
    [lesson, navigate, setLessonStep],
  );

  useEffect(() => {
    if (valid && lesson) enterLesson(lesson.id, stepIndex);
  }, [enterLesson, lesson, stepIndex, valid]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(stepIndex - 1);
      if (event.key === 'ArrowRight') go(stepIndex + 1);
      if (event.key.toLowerCase() === 'r') setReplay((value) => value + 1);
      if (event.key === 'Escape') selectEntity(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, selectEntity, stepIndex]);

  if (!params.lessonId) return <Navigate to="/learn/cluster-overview/0" replace />;
  if (!valid || !lesson || !compiled) return <Navigate to="/learn/cluster-overview/0" replace />;
  const step = lesson.steps[stepIndex];
  const projection = courseEngine.getProjection(compiled, stepIndex);
  const transition = [...courseEngine.getTransition(compiled, stepIndex)];
  if (!step) return null;
  return (
    <main className="learn-page">
      <aside className="course-nav">
        <div className="panel-title">
          <BookOpen size={17} />
          {course.title[locale]}
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
                    <small>{entry.estimatedMinutes} min</small>
                  </span>
                </Link>
              </li>
            ))}
        </ol>
      </aside>
      <section className="learn-stage">
        <div className="view-badge">{projection.view.replace('-', ' ').toUpperCase()}</div>
        <SceneViewport
          key={`lesson-${lesson.id}`}
          graph={graph}
          projection={projection}
          transition={transition}
          selectedEntityId={selected}
          locale={locale}
          reducedMotion={reducedMotion}
          onSelectEntity={selectEntity}
        />
        <div className="lesson-controls">
          <button onClick={() => go(stepIndex - 1)} disabled={stepIndex === 0}>
            <ChevronLeft size={18} />
            {t.previous}
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
          <button onClick={() => setReplay((value) => value + 1)}>
            <Play size={16} />
            {t.replay}
          </button>
          <button
            className="primary"
            onClick={() => go(stepIndex + 1)}
            disabled={stepIndex === lesson.steps.length - 1}
          >
            {t.next}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <aside className="narration-panel">
        <div className="step-kicker">
          LESSON {course.lessons.findIndex((entry) => entry.id === lesson.id) + 1} · STEP{' '}
          {stepIndex + 1}
        </div>
        <h1>{step.title[locale]}</h1>
        <div className="objective">
          <Target size={17} />
          <div>
            <strong>{t.objective}</strong>
            <p>{step.learningOutcome[locale]}</p>
          </div>
        </div>
        <p className="narration">{step.narration[locale]}</p>
        {step.introducesTerms.length > 0 && (
          <section>
            <h2>{t.terms}</h2>
            {step.introducesTerms.map((id) => {
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
          {step.sourceIds.map((id) => {
            const source = sources.get(id);
            return source ? (
              <a key={id} href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
                <span>{source.authority}</span>
              </a>
            ) : null;
          })}
          <small>Verified {lesson.verifiedAt}</small>
        </section>
      </aside>
    </main>
  );
}
