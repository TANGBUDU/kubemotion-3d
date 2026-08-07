import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { course, glossaryById, lessonById, scenarioById, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import type { PlaybackRequest } from '../course/types';
import { useAppStore } from '../state/appStore';
import { CompareView } from '../ui/lesson/CompareView';
import { CourseDrawer } from '../ui/lesson/CourseDrawer';
import { InspectorDrawer, type DetailSection } from '../ui/lesson/InspectorDrawer';
import { LessonHeader } from '../ui/lesson/LessonHeader';
import { LessonShell } from '../ui/lesson/LessonShell';
import { MobileTeachingSheet } from '../ui/lesson/MobileTeachingSheet';
import { SceneLegend } from '../ui/lesson/SceneLegend';
import { StepTimeline } from '../ui/lesson/StepTimeline';
import { TeachingPanel } from '../ui/lesson/TeachingPanel';
import { lessonUi } from '../ui/lesson/copy';
import { useMediaQuery } from '../ui/lesson/useMediaQuery';
import { getContainerData, getPodData, getReplicaSetData } from '../world';
import type { EntityId, WorldEntity } from '../world/types';

const GOLDEN_LESSON = 'container-restart-vs-pod-replacement';

const chapterTitles: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  en: {
    'workloads-self-healing': 'Workloads & Self-Healing',
    'networking-resilience': 'Networking & Resilience',
  },
  ja: {
    'workloads-self-healing': 'ワークロードと自己修復',
    'networking-resilience': 'ネットワークと耐障害性',
  },
  'zh-CN': {
    'workloads-self-healing': '工作负载与自愈',
    'networking-resilience': '网络与韧性',
  },
};

function chapterTitle(id: string, locale: Locale): string {
  return (
    chapterTitles[locale][id] ??
    id
      .split('-')
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  );
}

function podForEntity(
  world: Readonly<Record<EntityId, WorldEntity>>,
  selected: EntityId | undefined,
): WorldEntity | undefined {
  const candidate = selected ? world[selected] : undefined;
  if (!candidate) return undefined;
  if (candidate.kind === 'Pod') return candidate;
  if (candidate.kind === 'Container' && typeof candidate.data.podId === 'string') {
    return world[candidate.data.podId];
  }
  return undefined;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function LearnPage() {
  const params = useParams();
  const navigate = useNavigate();
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const selected = useAppStore((state) => state.selectedEntityId);
  const selectEntity = useAppStore((state) => state.selectEntity);
  const enterLesson = useAppStore((state) => state.enterLesson);
  const setLessonStep = useAppStore((state) => state.setLessonStep);
  const lesson = params.lessonId ? lessonById.get(params.lessonId) : undefined;
  const compiled = useMemo(() => {
    if (!lesson) return undefined;
    const lessonScenario = scenarioById.get(lesson.scenarioId);
    return lessonScenario ? courseEngine.compileLesson(lesson, lessonScenario) : undefined;
  }, [lesson]);
  const stepIndex = Number(params.stepIndex ?? 0);
  const [playbackId, setPlaybackId] = useState(0);
  const [cameraResetId, setCameraResetId] = useState(0);
  const [courseOpen, setCourseOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailSection, setDetailSection] = useState<DetailSection>('inspector');
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const isMobile = useMediaQuery('(max-width: 720px)');
  const t = lessonUi(locale);
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
      setDetailsOpen(false);
      setCourseOpen(false);
      setLessonStep(index);
      setPlaybackId((value) => value + 1);
      navigate(`/learn/${lesson.id}/${index}`);
    },
    [lesson, navigate, selectEntity, setLessonStep],
  );

  const handleSelectEntity = useCallback(
    (id?: EntityId) => {
      selectEntity(id);
      if (id) {
        setDetailSection('inspector');
        setDetailsOpen(true);
      } else if (detailSection === 'inspector') {
        setDetailsOpen(false);
      }
    },
    [detailSection, selectEntity],
  );

  const openDetails = useCallback((section: DetailSection) => {
    setDetailSection(section);
    setDetailsOpen(true);
  }, []);

  useEffect(() => {
    if (valid && lesson) enterLesson(lesson.id, stepIndex);
  }, [enterLesson, lesson, stepIndex, valid]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCourseOpen(false);
        setDetailsOpen(false);
        selectEntity(undefined);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(stepIndex - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(stepIndex + 1);
      }
      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setPlaybackId((value) => value + 1);
      }
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
  const selectedEntity = selected ? step.world.entities[selected] : undefined;
  const pod = podForEntity(step.world.entities, selected);
  const podData = pod ? getPodData(pod) : undefined;
  const container =
    selectedEntity?.kind === 'Container'
      ? selectedEntity
      : pod
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
  const selectedReplicaSetData =
    selectedEntity?.kind === 'ReplicaSet' ? getReplicaSetData(selectedEntity) : undefined;
  const replicaSet = Object.values(step.world.entities).find(
    (entity) => entity.kind === 'ReplicaSet',
  );
  const replicaCounts = replicaSet ? getReplicaSetData(replicaSet) : undefined;
  const inspectorFacts = selectedEntity
    ? [
        { label: 'Name', value: selectedEntity.name },
        { label: 'Kind', value: selectedEntity.kind },
        { label: 'Status', value: selectedEntity.status },
        ...(selectedEntity.namespace
          ? [{ label: 'Namespace', value: selectedEntity.namespace }]
          : []),
        ...(podData
          ? [
              { label: 'Pod UID', value: podData.uid },
              { label: 'Node', value: podData.nodeName ?? 'Unscheduled' },
              { label: 'Pod phase', value: podData.phase },
            ]
          : []),
        ...(containerData
          ? [
              { label: 'Container state', value: container?.status ?? 'unknown' },
              { label: 'Restart count', value: String(containerData.restartCount) },
              { label: 'Generation', value: String(containerData.instanceGeneration) },
              { label: 'Image', value: containerData.image },
            ]
          : []),
        ...(selectedReplicaSetData
          ? [
              { label: 'Desired', value: String(selectedReplicaSetData.desiredReplicas) },
              { label: 'Current', value: String(selectedReplicaSetData.currentReplicas) },
              { label: 'Ready', value: String(selectedReplicaSetData.readyReplicas) },
            ]
          : []),
        ...(ownerEntity ? [{ label: 'Owner', value: ownerEntity.name }] : []),
      ]
    : [];
  const introducedTerms = authoredStep.introducesTerms.flatMap((id) => {
    const term = glossaryById.get(id);
    return term ? [term] : [];
  });
  const stepSources = authoredStep.sourceIds.flatMap((id) => {
    const source = sources.get(id);
    return source ? [source] : [];
  });
  const titles = lesson.steps.map((lessonStep) => lessonStep.title[locale]);
  const safeInsets = isMobile
    ? { top: 38, right: 16, bottom: sheetExpanded ? 28 : 16, left: 16 }
    : {
        top: 50,
        right: detailsOpen ? 48 : 20,
        bottom: 20,
        left: courseOpen ? 304 : 20,
      };
  const routeSummary = step.view.activeRoutes
    .map((route) => {
      const hops = route.hops
        .map((hop, index) => {
          const source = step.world.entities[hop.fromEntityId]?.name ?? hop.fromEntityId;
          const target = step.world.entities[hop.toEntityId]?.name ?? hop.toEntityId;
          const hopLabel = hop.label?.[locale];
          return `hop ${index + 1}${hopLabel ? ` (${hopLabel})` : ''}: source ${source} at ${hop.fromAnchor}, target ${target} at ${hop.toAnchor}`;
        })
        .join('; ');
      return `${route.label?.[locale] ?? route.semantic} route: ${hops}`;
    })
    .join('. ');
  const sceneSummary = [
    authoredStep.title[locale],
    authoredStep.teaching.whatChanged[locale],
    focusedId ? `Focused entity: ${step.world.entities[focusedId]?.name ?? focusedId}.` : '',
    replicaCounts
      ? `ReplicaSet desired ${replicaCounts.desiredReplicas}, current ${replicaCounts.currentReplicas}, ready ${replicaCounts.readyReplicas}.`
      : '',
    routeSummary ? `Visible ${routeSummary}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stage = (
    <>
      <div className="view-badge" aria-hidden="true">
        {step.view.view.replace('-', ' ').toUpperCase()}
      </div>
      {replicaCounts && (
        <p
          className="scene-fact-status sr-only"
          role="status"
          data-testid="replica-counts"
          data-world-revision={step.world.revision}
        >
          ReplicaSet Desired {replicaCounts.desiredReplicas} Current {replicaCounts.currentReplicas}{' '}
          Ready {replicaCounts.readyReplicas}
        </p>
      )}
      <p id="scene-accessible-summary" className="sr-only">
        {sceneSummary}
      </p>
      <div
        className={`scene-canvas ${step.view.comparison ? 'is-visually-suspended' : ''}`}
        role="img"
        aria-label={t.scene}
        aria-describedby="scene-accessible-summary"
      >
        <SceneViewport
          key={`lesson-${lesson.id}`}
          step={step}
          playback={playback}
          selectedEntityId={selected}
          locale={locale}
          reducedMotion={reducedMotion}
          cameraResetId={cameraResetId}
          safeInsets={safeInsets}
          onSelectEntity={handleSelectEntity}
        />
      </div>
      {!step.view.comparison && <SceneLegend locale={locale} />}
      {step.view.comparison && <CompareView model={step.view.comparison} locale={locale} />}
    </>
  );

  const teaching = (
    <MobileTeachingSheet
      locale={locale}
      stepLabel={t.stepOf(stepIndex + 1, lesson.steps.length)}
      title={authoredStep.title[locale]}
      expanded={sheetExpanded}
      onExpandedChange={setSheetExpanded}
    >
      <TeachingPanel
        locale={locale}
        stepIndex={stepIndex}
        stepCount={lesson.steps.length}
        title={authoredStep.title[locale]}
        whatChanged={authoredStep.teaching.whatChanged[locale]}
        whyItHappened={authoredStep.teaching.whyItHappened[locale]}
        takeaway={authoredStep.teaching.takeaway[locale]}
        evidence={step.evidence}
        termCount={introducedTerms.length}
        sourceCount={stepSources.length}
        onOpenTerms={() => openDetails('terms')}
        onOpenSources={() => openDetails('sources')}
      />
    </MobileTeachingSheet>
  );

  return (
    <LessonShell
      comparisonActive={Boolean(step.view.comparison)}
      announcement={`${t.stepOf(stepIndex + 1, lesson.steps.length)}. ${authoredStep.title[locale]}. ${authoredStep.teaching.whatChanged[locale]}`}
      header={
        <LessonHeader
          chapter={chapterTitle(lesson.chapterId, locale)}
          lessonTitle={lesson.title[locale]}
          stepIndex={stepIndex}
          stepCount={lesson.steps.length}
          locale={locale}
          courseOpen={courseOpen}
          onOpenCourse={() => setCourseOpen(true)}
          onReplay={() => setPlaybackId((value) => value + 1)}
          onResetCamera={() => setCameraResetId((value) => value + 1)}
          onLocaleChange={setLocale}
        />
      }
      stage={stage}
      teaching={teaching}
      timeline={
        <StepTimeline locale={locale} titles={titles} currentStep={stepIndex} onStepChange={go} />
      }
      drawers={
        <>
          <CourseDrawer
            open={courseOpen}
            locale={locale}
            courseTitle={course.title[locale]}
            currentLessonId={lesson.id}
            lessons={course.lessons}
            onClose={() => setCourseOpen(false)}
          />
          <InspectorDrawer
            open={detailsOpen}
            locale={locale}
            activeSection={detailSection}
            facts={inspectorFacts}
            terms={introducedTerms}
            sources={stepSources}
            verifiedAt={lesson.verifiedAt}
            onSectionChange={setDetailSection}
            onClose={() => setDetailsOpen(false)}
          />
        </>
      }
    />
  );
}
