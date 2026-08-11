import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { course, glossaryById, lessonById, scenarioById, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import type { PlaybackRequest } from '../course/types';
import { orderedAvailableLessons, resolveLessonEntry, useAppStore } from '../state/appStore';
import { CompareView } from '../ui/lesson/CompareView';
import { CourseDrawer } from '../ui/lesson/CourseDrawer';
import { InspectorDrawer, type DetailSection } from '../ui/lesson/InspectorDrawer';
import { LessonCompletionCard } from '../ui/lesson/LessonCompletionCard';
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

const availableLessons = orderedAvailableLessons(course, lessonById);
const lessonSafeExclusionSelectors = [
  '.lesson-header',
  '.mobile-teaching-sheet',
  '.step-timeline',
  '.inspector-drawer:not([hidden])',
] as const;

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

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, select, button, a[href], [role="tab"], [role="dialog"]') !==
      null
  );
}

interface EndpointConditionView {
  readonly ready: boolean;
  readonly serving: boolean | 'unknown';
  readonly terminating: boolean | 'unknown';
}

function readEndpointConditions(
  endpoint: Readonly<Record<string, unknown>>,
): EndpointConditionView {
  const conditions =
    endpoint.conditions &&
    typeof endpoint.conditions === 'object' &&
    !Array.isArray(endpoint.conditions)
      ? (endpoint.conditions as Readonly<Record<string, unknown>>)
      : {};
  return {
    // EndpointConditions.ready defaults to true when the field is omitted.
    ready: conditions.ready !== false,
    serving: typeof conditions.serving === 'boolean' ? conditions.serving : 'unknown',
    terminating: typeof conditions.terminating === 'boolean' ? conditions.terminating : 'unknown',
  };
}

function endpointConditionText(conditions: EndpointConditionView, separator: string): string {
  return [
    `ready=${conditions.ready}`,
    `serving=${conditions.serving}`,
    `terminating=${conditions.terminating}`,
  ].join(separator);
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
  const completeLesson = useAppStore((state) => state.completeLesson);
  const retryProgressSave = useAppStore((state) => state.retryProgressSave);
  const savedLessonId = useAppStore((state) => state.lessonId);
  const savedStepIndex = useAppStore((state) => state.stepIndex);
  const completedLessonIds = useAppStore((state) => state.completedLessonIds);
  const progressSaveStatusByLesson = useAppStore((state) => state.progressSaveStatusByLesson);
  const resumeEntry = resolveLessonEntry(availableLessons, {
    lessonId: savedLessonId,
    stepIndex: savedStepIndex,
    completedLessonIds,
  });
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [sceneViewportClass, setSceneViewportClass] = useState<'mobile' | 'desktop'>(() =>
    isMobile ? 'mobile' : 'desktop',
  );
  const lesson = params.lessonId ? lessonById.get(params.lessonId) : undefined;
  const compiled = useMemo(() => {
    if (!lesson) return undefined;
    const lessonScenario = scenarioById.get(lesson.scenarioId);
    return lessonScenario
      ? courseEngine.compileLesson(lesson, lessonScenario, {
          viewport: sceneViewportClass,
        })
      : undefined;
  }, [lesson, sceneViewportClass]);
  const stepIndex = Number(params.stepIndex ?? 0);
  const [playbackId, setPlaybackId] = useState(0);
  const [cameraResetId, setCameraResetId] = useState(0);
  const [courseOpen, setCourseOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailSection, setDetailSection] = useState<DetailSection>('inspector');
  const [sheetExpanded, setSheetExpanded] = useState(() => !isMobile);
  const t = lessonUi(locale);
  const valid = Boolean(
    lesson &&
    compiled &&
    Number.isInteger(stepIndex) &&
    stepIndex >= 0 &&
    stepIndex < lesson.steps.length,
  );
  const isFinalStep = Boolean(valid && lesson && stepIndex === lesson.steps.length - 1);

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
  const restartLesson = useCallback(() => go(0), [go]);

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
      if (isInteractiveTarget(event.target)) return;
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
        if (isFinalStep) restartLesson();
        else setPlaybackId((value) => value + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, isFinalStep, restartLesson, selectEntity, stepIndex]);

  if (availableLessons.length === 0) throw new Error('No verified lesson is available');
  const resumePath = resumeEntry
    ? `/learn/${resumeEntry.lessonId}/${resumeEntry.stepIndex}`
    : '/explore';
  if (!params.lessonId) return <Navigate to={resumePath} replace />;
  if (lesson && compiled && (params.stepIndex === undefined || !valid)) {
    return <Navigate to={`/learn/${lesson.id}/0`} replace />;
  }
  if (!valid || !lesson || !compiled) return <Navigate to={resumePath} replace />;
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
  const endpointSlice = Object.values(step.world.entities).find(
    (entity) => entity.kind === 'EndpointSlice',
  );
  const endpointConditionFacts =
    selectedEntity?.kind === 'EndpointSlice' && Array.isArray(selectedEntity.data.endpoints)
      ? selectedEntity.data.endpoints.flatMap((candidate) => {
          if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
          const endpoint = candidate as Readonly<Record<string, unknown>>;
          const conditions = readEndpointConditions(endpoint);
          const targetRef = String(endpoint.targetRef ?? endpoint.address ?? 'endpoint');
          const target =
            step.world.entities[targetRef]?.name ?? targetRef.split(':').at(-1) ?? targetRef;
          return [
            {
              label: `${target} Endpoint conditions`,
              value: endpointConditionText(conditions, ' · '),
            },
          ];
        })
      : [];
  const inspectorFacts = selectedEntity
    ? [
        { label: 'Name', value: selectedEntity.name },
        { label: 'Kind', value: selectedEntity.kind },
        ...(selectedEntity.namespace
          ? [{ label: 'Namespace', value: selectedEntity.namespace }]
          : []),
        ...(podData
          ? [
              { label: 'Pod UID', value: podData.uid },
              { label: 'Node', value: podData.nodeName ?? 'Unscheduled' },
              { label: 'Pod phase', value: podData.phase },
              { label: 'PodScheduled', value: String(podData.conditions.podScheduled) },
              { label: 'Initialized', value: String(podData.conditions.initialized) },
              { label: 'ContainersReady', value: String(podData.conditions.containersReady) },
              { label: 'Pod Ready', value: String(podData.conditions.ready) },
            ]
          : []),
        ...(containerData
          ? [
              { label: 'Container state', value: containerData.state.kind },
              { label: 'Container ID', value: containerData.containerID || 'Not created' },
              { label: 'Container Ready', value: String(containerData.ready) },
              { label: 'Started', value: String(containerData.started) },
              { label: 'Restart count', value: String(containerData.restartCount) },
              ...(containerData.lastState
                ? [
                    { label: 'Last termination', value: containerData.lastState.reason },
                    { label: 'Last exit code', value: String(containerData.lastState.exitCode) },
                  ]
                : []),
              { label: 'Image', value: containerData.image },
            ]
          : []),
        ...(selectedReplicaSetData
          ? [
              {
                label: '.spec.replicas (SPEC)',
                value: String(selectedReplicaSetData.specReplicas),
              },
              {
                label: '.status.replicas (OBSERVED)',
                value: String(selectedReplicaSetData.statusReplicas),
              },
              {
                label: '.status.readyReplicas (READY)',
                value: String(selectedReplicaSetData.readyReplicas),
              },
            ]
          : []),
        ...endpointConditionFacts,
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
  const lessonCompleted = completedLessonIds.includes(lesson.id);
  const lessonSaveStatus = progressSaveStatusByLesson[lesson.id] ?? 'idle';
  const nextLesson = availableLessons.find(
    (candidate) => candidate.id !== lesson.id && !completedLessonIds.includes(candidate.id),
  );
  const safeInsets = isMobile
    ? { top: 12, right: 12, bottom: 12, left: 12 }
    : { top: 18, right: 18, bottom: 18, left: 18 };
  const firstActiveRoute = step.view.activeRoutes[0];
  const focusHint = firstActiveRoute
    ? (() => {
        const firstHop = firstActiveRoute.hops[0];
        const lastHop = firstActiveRoute.hops[firstActiveRoute.hops.length - 1];
        const source = firstHop
          ? (step.world.entities[firstHop.fromEntityId]?.name ?? firstHop.fromEntityId)
          : firstActiveRoute.semantic;
        const target = lastHop
          ? (step.world.entities[lastHop.toEntityId]?.name ?? lastHop.toEntityId)
          : firstActiveRoute.semantic;
        return t.followPath(source, target);
      })()
    : focusedId
      ? t.focusOn(step.world.entities[focusedId]?.name ?? focusedId)
      : t.focusOn(authoredStep.title[locale]);
  const visibleRelationSemantics = Array.from(
    new Set(
      Object.entries(step.view.relationStates)
        .filter(([, state]) => state.visible)
        .flatMap(([relationId]) => {
          const relation = step.world.relations[relationId];
          return relation ? [relation.semantic] : [];
        }),
    ),
  );
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
  const endpointSummary =
    endpointSlice && Array.isArray(endpointSlice.data.endpoints)
      ? endpointSlice.data.endpoints
          .flatMap((candidate) => {
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
            const endpoint = candidate as Readonly<Record<string, unknown>>;
            const conditions = readEndpointConditions(endpoint);
            const targetRef = String(endpoint.targetRef ?? endpoint.address ?? 'endpoint');
            const target =
              step.world.entities[targetRef]?.name ?? targetRef.split(':').at(-1) ?? targetRef;
            return [`${target} endpoint ${endpointConditionText(conditions, ', ')}`];
          })
          .join('; ')
      : '';
  const changedPodSummary = step.worldDiff.updatedEntities
    .flatMap((update) => {
      if (update.after.kind !== 'Pod') return [];
      const hasRelevantChange = update.changedPaths.some(
        (path) =>
          path === '/status' || path === '/data/phase' || path.startsWith('/data/conditions/'),
      );
      if (!hasRelevantChange) return [];
      const data = getPodData(update.after);
      return [
        `Pod ${update.after.name}: phase ${data.phase}; ContainersReady ${data.conditions.containersReady}; Ready ${data.conditions.ready}.`,
      ];
    })
    .join(' ');
  const pendingContainerStatusSummary = Object.values(step.world.entities)
    .filter((entity) => {
      if (entity.kind !== 'Container') return false;
      const data = getContainerData(entity);
      return !data.containerID && data.state.kind === 'waiting';
    })
    .map((entity) => entity.summary[locale])
    .join(' ');
  const sceneSummary = [
    authoredStep.title[locale],
    authoredStep.teaching.whatChanged[locale],
    focusedId ? `Focused entity: ${step.world.entities[focusedId]?.name ?? focusedId}.` : '',
    replicaCounts
      ? `ReplicaSet SPEC ${replicaCounts.specReplicas}, OBSERVED ${replicaCounts.statusReplicas}, READY ${replicaCounts.readyReplicas}.`
      : '',
    changedPodSummary,
    pendingContainerStatusSummary,
    endpointSummary ? `EndpointSlice conditions: ${endpointSummary}.` : '',
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
          ReplicaSet SPEC {replicaCounts.specReplicas} OBSERVED {replicaCounts.statusReplicas} READY{' '}
          {replicaCounts.readyReplicas}
        </p>
      )}
      <p id="scene-accessible-summary" className="sr-only">
        {sceneSummary}
      </p>
      {!step.view.comparison && (
        <>
          <div className="scene-canvas">
            <SceneViewport
              key={`lesson-${lesson.id}`}
              role="img"
              aria-label={t.scene}
              aria-describedby="scene-accessible-summary"
              step={step}
              playback={playback}
              selectedEntityId={selected}
              locale={locale}
              reducedMotion={reducedMotion}
              cameraResetId={cameraResetId}
              cameraMode="orthographic"
              safeInsets={safeInsets}
              safeExclusionSelectors={lessonSafeExclusionSelectors}
              safeViewportRevision={`${isMobile}:${sheetExpanded}:${detailsOpen}:${courseOpen}`}
              onViewportClassChange={setSceneViewportClass}
              onSelectEntity={handleSelectEntity}
            />
          </div>
          <SceneLegend
            locale={locale}
            view={step.view.view}
            activeRoutes={step.view.activeRoutes}
            relationSemantics={visibleRelationSemantics}
          />
        </>
      )}
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
      {isFinalStep && (
        <LessonCompletionCard
          locale={locale}
          lessonTitle={lesson.title[locale]}
          completed={lessonCompleted}
          saveStatus={lessonSaveStatus}
          nextLesson={
            nextLesson ? { id: nextLesson.id, title: nextLesson.title[locale] } : undefined
          }
          onComplete={() =>
            completeLesson(lesson.id, {
              title: lesson.title,
              completionStepIndex: lesson.steps.length - 1,
            })
          }
          onRetry={() => retryProgressSave(lesson.id)}
          onRestart={restartLesson}
        />
      )}
      <TeachingPanel
        locale={locale}
        stepIndex={stepIndex}
        stepCount={lesson.steps.length}
        title={authoredStep.title[locale]}
        narration={authoredStep.narration[locale]}
        focusHint={focusHint}
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
          canResetCamera={!step.view.comparison}
          onOpenCourse={() => setCourseOpen(true)}
          onReplay={isFinalStep ? restartLesson : () => setPlaybackId((value) => value + 1)}
          onResetCamera={() => setCameraResetId((value) => value + 1)}
          onLocaleChange={setLocale}
        />
      }
      stage={stage}
      teaching={teaching}
      timeline={
        <StepTimeline
          lessonId={lesson.id}
          locale={locale}
          titles={titles}
          currentStep={stepIndex}
          onStepChange={go}
        />
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
