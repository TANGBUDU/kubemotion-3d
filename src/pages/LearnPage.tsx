import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Locale } from '../app/types';
import {
  chapterPresentation,
  componentExplanation,
  friendlyEntityName,
} from '../app/entityPresentation';
import { beginnerProblemStageKindForStep } from '../components/BeginnerProblemStage';
import { SceneViewport } from '../components/SceneViewport';
import { course, glossaryById, lessonById, scenarioById, sources } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { beginnerFocusedStep } from '../course/beginnerProjection';
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
import { SceneOrientation } from '../ui/lesson/SceneOrientation';
import { StepTimeline } from '../ui/lesson/StepTimeline';
import { TeachingPanel } from '../ui/lesson/TeachingPanel';
import { lessonUi } from '../ui/lesson/copy';
import { useMediaQuery } from '../ui/lesson/useMediaQuery';
import { getContainerData, getPodData, getReplicaSetData } from '../world';
import type { EntityId, WorldEntity } from '../world/types';

const availableLessons = orderedAvailableLessons(course, lessonById);
const lessonSafeExclusionSelectors = [
  '.lesson-header',
  '.scene-orientation',
  '.mobile-teaching-sheet',
  '.step-timeline',
  '.inspector-drawer:not([hidden])',
] as const;

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

const inspectorCopy = (locale: Locale) => {
  const copy = {
    en: {
      name: 'Teaching name',
      technicalName: 'Kubernetes name',
      kind: 'Object type',
      namespace: 'Logical scope',
      podUid: 'Pod identity (UID)',
      node: 'Runs on Node',
      unscheduled: 'Not assigned yet',
      podPhase: 'Pod phase',
      podScheduled: 'Node selected',
      initialized: 'Initialization complete',
      containersReady: 'All containers Ready',
      podReady: 'Pod Ready',
      containerState: 'Container state',
      containerId: 'Runtime container ID',
      notCreated: 'Not created yet',
      containerReady: 'Container Ready',
      started: 'Container started',
      restartCount: 'Restart count',
      lastTermination: 'Previous stop reason',
      lastExitCode: 'Previous exit code',
      image: 'Container image',
      desired: 'Desired replicas',
      current: 'Current replicas',
      ready: 'Ready replicas',
      owner: 'Managed by',
    },
    ja: {
      name: '学習用の名前',
      technicalName: 'Kubernetes 上の名前',
      kind: 'オブジェクト種別',
      namespace: '論理スコープ',
      podUid: 'Pod の識別子 (UID)',
      node: '実行先 Node',
      unscheduled: 'まだ未割り当て',
      podPhase: 'Pod phase',
      podScheduled: 'Node 選択済み',
      initialized: '初期化完了',
      containersReady: '全 Container Ready',
      podReady: 'Pod Ready',
      containerState: 'Container 状態',
      containerId: 'runtime Container ID',
      notCreated: 'まだ作成されていない',
      containerReady: 'Container Ready',
      started: 'Container 起動済み',
      restartCount: '再起動回数',
      lastTermination: '直前の停止理由',
      lastExitCode: '直前の exit code',
      image: 'Container image',
      desired: '目標レプリカ数',
      current: '現在レプリカ数',
      ready: 'Ready レプリカ数',
      owner: '管理元',
    },
    'zh-CN': {
      name: '教学名称',
      technicalName: 'Kubernetes 原始名称',
      kind: '对象类型',
      namespace: '逻辑范围',
      podUid: 'Pod 身份 (UID)',
      node: '运行所在 Node',
      unscheduled: '尚未分配',
      podPhase: 'Pod 阶段',
      podScheduled: '已经选择 Node',
      initialized: '初始化完成',
      containersReady: '全部容器 Ready',
      podReady: 'Pod Ready',
      containerState: '容器状态',
      containerId: '运行时容器 ID',
      notCreated: '尚未创建',
      containerReady: '容器 Ready',
      started: '容器已启动',
      restartCount: '重启次数',
      lastTermination: '上一次停止原因',
      lastExitCode: '上一次退出码',
      image: '容器镜像',
      desired: '期望副本数',
      current: '当前副本数',
      ready: 'Ready 副本数',
      owner: '由谁管理',
    },
  } as const;
  return copy[locale];
};

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
  const [sheetExpandedOverride, setSheetExpandedOverride] = useState<boolean | null>(null);
  const sheetExpanded = sheetExpandedOverride ?? !isMobile;
  const t = lessonUi(locale);
  const inspectorText = inspectorCopy(locale);
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
  const rawStep = compiled.steps[stepIndex];
  if (!authoredStep || !rawStep) return null;
  const step = beginnerFocusedStep(rawStep);

  const playback: PlaybackRequest = {
    stepKey: `${lesson.id}:${step.stepId}`,
    playbackId,
    transition: step.transition,
  };
  const focusedId =
    Object.entries(step.view.entityStates).find(
      ([, state]) => state.visible && state.inspectorMode === 'expanded',
    )?.[0] ??
    Object.entries(step.view.entityStates).find(
      ([, state]) => state.visible && state.emphasis === 'focused',
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
          const targetEntity = step.world.entities[targetRef];
          const target = targetEntity
            ? friendlyEntityName(targetEntity, locale)
            : (targetRef.split(':').at(-1) ?? targetRef);
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
        { label: inspectorText.name, value: friendlyEntityName(selectedEntity, locale) },
        { label: inspectorText.technicalName, value: selectedEntity.name },
        { label: inspectorText.kind, value: selectedEntity.kind },
        ...(selectedEntity.namespace
          ? [{ label: inspectorText.namespace, value: selectedEntity.namespace }]
          : []),
        ...(podData
          ? [
              { label: inspectorText.podUid, value: podData.uid },
              { label: inspectorText.node, value: podData.nodeName ?? inspectorText.unscheduled },
              { label: inspectorText.podPhase, value: podData.phase },
              { label: inspectorText.podScheduled, value: String(podData.conditions.podScheduled) },
              { label: inspectorText.initialized, value: String(podData.conditions.initialized) },
              {
                label: inspectorText.containersReady,
                value: String(podData.conditions.containersReady),
              },
              { label: inspectorText.podReady, value: String(podData.conditions.ready) },
            ]
          : []),
        ...(containerData
          ? [
              { label: inspectorText.containerState, value: containerData.state.kind },
              {
                label: inspectorText.containerId,
                value: containerData.containerID || inspectorText.notCreated,
              },
              { label: inspectorText.containerReady, value: String(containerData.ready) },
              { label: inspectorText.started, value: String(containerData.started) },
              { label: inspectorText.restartCount, value: String(containerData.restartCount) },
              ...(containerData.lastState
                ? [
                    { label: inspectorText.lastTermination, value: containerData.lastState.reason },
                    {
                      label: inspectorText.lastExitCode,
                      value: String(containerData.lastState.exitCode),
                    },
                  ]
                : []),
              { label: inspectorText.image, value: containerData.image },
            ]
          : []),
        ...(selectedReplicaSetData
          ? [
              { label: inspectorText.desired, value: String(selectedReplicaSetData.specReplicas) },
              {
                label: inspectorText.current,
                value: String(selectedReplicaSetData.statusReplicas),
              },
              { label: inspectorText.ready, value: String(selectedReplicaSetData.readyReplicas) },
            ]
          : []),
        ...endpointConditionFacts,
        ...(ownerEntity
          ? [{ label: inspectorText.owner, value: friendlyEntityName(ownerEntity, locale) }]
          : []),
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
        const sourceEntity = firstHop ? step.world.entities[firstHop.fromEntityId] : undefined;
        const targetEntity = lastHop ? step.world.entities[lastHop.toEntityId] : undefined;
        const source = sourceEntity
          ? friendlyEntityName(sourceEntity, locale)
          : (firstHop?.fromEntityId ?? firstActiveRoute.semantic);
        const target = targetEntity
          ? friendlyEntityName(targetEntity, locale)
          : (lastHop?.toEntityId ?? firstActiveRoute.semantic);
        return t.followPath(source, target);
      })()
    : focusedId
      ? t.focusOn(
          step.world.entities[focusedId]
            ? friendlyEntityName(step.world.entities[focusedId], locale)
            : focusedId,
        )
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
          const sourceEntity = step.world.entities[hop.fromEntityId];
          const targetEntity = step.world.entities[hop.toEntityId];
          const source = sourceEntity ? friendlyEntityName(sourceEntity, locale) : hop.fromEntityId;
          const target = targetEntity ? friendlyEntityName(targetEntity, locale) : hop.toEntityId;
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
            const targetEntity = step.world.entities[targetRef];
            const target = targetEntity
              ? friendlyEntityName(targetEntity, locale)
              : (targetRef.split(':').at(-1) ?? targetRef);
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
        `Pod ${friendlyEntityName(update.after, locale)}: phase ${data.phase}; ContainersReady ${data.conditions.containersReady}; Ready ${data.conditions.ready}.`,
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
    focusedId && step.world.entities[focusedId]
      ? `Focused entity: ${friendlyEntityName(step.world.entities[focusedId], locale)}.`
      : '',
    replicaCounts
      ? `Replica target ${replicaCounts.specReplicas}, current ${replicaCounts.statusReplicas}, ready ${replicaCounts.readyReplicas}.`
      : '',
    changedPodSummary,
    pendingContainerStatusSummary,
    endpointSummary ? `EndpointSlice conditions: ${endpointSummary}.` : '',
    routeSummary ? `Visible ${routeSummary}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isProblemStage = beginnerProblemStageKindForStep(step) !== undefined;

  const stage = (
    <>
      {!isProblemStage ? <SceneOrientation view={step.view.view} locale={locale} /> : null}
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
          <div className={`scene-canvas${isProblemStage ? ' is-problem-stage' : ''}`}>
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
          {!isProblemStage ? (
            <SceneLegend
              locale={locale}
              view={step.view.view}
              activeRoutes={step.view.activeRoutes}
              relationSemantics={visibleRelationSemantics}
            />
          ) : null}
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
      onExpandedChange={setSheetExpandedOverride}
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
        component={componentExplanation(
          selectedEntity ?? (focusedId ? step.world.entities[focusedId] : undefined),
          locale,
        )}
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
          chapter={chapterPresentation(lesson.chapterId, locale)}
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
