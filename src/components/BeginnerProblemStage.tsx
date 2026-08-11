import {
  Activity,
  Box,
  CheckCircle2,
  CircleHelp,
  Eye,
  GitCompareArrows,
  PlusCircle,
  RefreshCw,
  ServerCog,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Locale } from '../app/types';
import type { CompiledStep } from '../course/types';
import '../styles/beginner-problem-stage.css';

export type BeginnerProblemStageKind =
  'single-container' | 'manual-replicas' | 'desired-state' | 'replica-gap' | 'controller-loop';

interface BeginnerProblemStageProps {
  readonly kind: BeginnerProblemStageKind;
  readonly locale: Locale;
  readonly ariaLabel?: string | undefined;
  readonly onViewportClassChange?: ((viewport: 'mobile' | 'desktop') => void) | undefined;
}

interface BeginnerProblemStageCopy {
  readonly before: string;
  readonly singleTitle: string;
  readonly singleIntro: string;
  readonly runtime: string;
  readonly container: string;
  readonly running: string;
  readonly singleQuestion: string;
  readonly singleConclusion: string;
  readonly replicasTitle: string;
  readonly replicasIntro: string;
  readonly you: string;
  readonly chores: readonly [string, string, string, string];
  readonly replicasConclusion: string;
  readonly desiredTitle: string;
  readonly desiredIntro: string;
  readonly desiredLabel: string;
  readonly currentLabel: string;
  readonly compareContinuously: string;
  readonly desiredConclusion: string;
  readonly gapTitle: string;
  readonly gapIntro: string;
  readonly missing: string;
  readonly gapLabel: string;
  readonly gapConclusion: string;
  readonly controllerTitle: string;
  readonly controllerIntro: string;
  readonly controller: string;
  readonly observe: string;
  readonly observeDetail: string;
  readonly compare: string;
  readonly compareDetail: string;
  readonly act: string;
  readonly actDetail: string;
  readonly controllerBoundary: string;
  readonly controllerConclusion: string;
}

const copy: Readonly<Record<Locale, BeginnerProblemStageCopy>> = {
  en: {
    before: 'Before Kubernetes',
    singleTitle: 'One container can already run your app',
    singleIntro: 'A container runtime is enough for this simple job.',
    runtime: 'Container runtime',
    container: 'api container',
    running: 'Application is running',
    singleQuestion: 'If this process stops tomorrow, who notices and restores it?',
    singleConclusion: 'Kubernetes is not needed just to start one process.',
    replicasTitle: 'Starting three copies is easy. Keeping three healthy is the hard part.',
    replicasIntro:
      'You can launch three copies by hand—but then someone must continuously manage them.',
    you: 'Without orchestration, that controller is you',
    chores: [
      'Detect a failure',
      'Count what remains',
      'Choose where a replacement runs',
      'Start it again',
    ],
    replicasConclusion: 'This continuing maintenance problem is where Kubernetes becomes useful.',
    desiredTitle: 'Declare the result, not a one-time command',
    desiredIntro:
      'Instead of saying “start three now,” you store a durable target: three healthy copies should remain true.',
    desiredLabel: 'Desired state',
    currentLabel: 'Current state',
    compareContinuously: 'Kubernetes keeps comparing these two numbers',
    desiredConclusion: 'Desired state is the promise Kubernetes keeps checking.',
    gapTitle: 'A failure creates a visible gap',
    gapIntro: 'One copy disappears. The target stays 3, but reality drops to 2.',
    missing: 'missing copy',
    gapLabel: 'Gap to repair',
    gapConclusion: 'Self-healing begins when desired state and current state no longer match.',
    controllerTitle: 'The controller loop repairs the mismatch',
    controllerIntro:
      'A controller does not use magic. It repeats three small actions through the Kubernetes API.',
    controller: 'Controller Manager',
    observe: 'Observe',
    observeDetail: 'Read desired and current state through the API Server',
    compare: 'Compare',
    compareDetail: 'Wanted 3, present 2 — one copy is missing',
    act: 'Act',
    actDetail: 'Create one new Pending Pod object',
    controllerBoundary: 'It does not choose a Node or start the container.',
    controllerConclusion: 'Kubernetes self-healing is observe → compare → act → observe again.',
  },
  ja: {
    before: 'Kubernetes を使う前',
    singleTitle: '1つのコンテナだけでもアプリは動く',
    singleIntro: 'この単純な仕事なら、コンテナランタイムだけで十分です。',
    runtime: 'コンテナランタイム',
    container: 'api コンテナ',
    running: 'アプリは実行中',
    singleQuestion: '明日このプロセスが止まったら、誰が気づいて復旧しますか？',
    singleConclusion: '1つのプロセスを起動するだけなら Kubernetes は不要です。',
    replicasTitle: '3つ起動するのは簡単。3つを正常に保つのが難しい。',
    replicasIntro:
      '手動で3つ起動できます。しかし、その後は誰かが継続して管理しなければなりません。',
    you: 'オーケストレーションがなければ、その controller はあなたです',
    chores: ['障害を見つける', '残っている数を数える', '置換先を選ぶ', 'もう一度起動する'],
    replicasConclusion: 'この「継続して守る」問題で Kubernetes が役立ちます。',
    desiredTitle: '一度きりの命令ではなく、結果を宣言する',
    desiredIntro: '「今3つ起動」ではなく、「正常な3コピーを保つ」という継続する目標を保存します。',
    desiredLabel: '望ましい状態',
    currentLabel: '現在の状態',
    compareContinuously: 'Kubernetes はこの2つを繰り返し比較する',
    desiredConclusion: '望ましい状態は、Kubernetes が確認し続ける約束です。',
    gapTitle: '障害が起きると差が見える',
    gapIntro: '1コピーが消えます。目標は3のまま、現実だけが2になります。',
    missing: '不足しているコピー',
    gapLabel: '修復すべき差',
    gapConclusion: '自己修復は、望ましい状態と現在状態の不一致から始まります。',
    controllerTitle: 'Controller loop が不一致を修復する',
    controllerIntro:
      'Controller は魔法を使いません。Kubernetes API を通して3つの小さな動作を繰り返します。',
    controller: 'Controller Manager',
    observe: '観察',
    observeDetail: 'API Server から目標と現在状態を読む',
    compare: '比較',
    compareDetail: '必要3、存在2 — 1コピー不足',
    act: '行動',
    actDetail: '新しい Pending Pod オブジェクトを1つ作る',
    controllerBoundary: 'Node の選択も Container の起動も担当しません。',
    controllerConclusion: '自己修復は 観察 → 比較 → 行動 → 再観察 のループです。',
  },
  'zh-CN': {
    before: '还没有使用 Kubernetes',
    singleTitle: '一个容器，本来就能把应用跑起来',
    singleIntro: '只是完成这件简单的事，容器运行时已经够用。',
    runtime: '容器运行时',
    container: 'api 容器',
    running: '应用正在运行',
    singleQuestion: '如果这个进程明天挂了，谁来发现它、再把它恢复？',
    singleConclusion: '只是启动一个进程，并不需要 Kubernetes。',
    replicasTitle: '启动三份很容易，长期保持三份健康才是难点',
    replicasIntro: '你当然可以手动启动三份，但从此必须有人持续管理它们。',
    you: '没有编排系统时，那个“控制器”就是你自己',
    chores: ['发现故障', '数还剩几份', '决定替换副本放哪里', '重新把它启动起来'],
    replicasConclusion: 'Kubernetes 真正解决的是这种持续维护问题。',
    desiredTitle: '声明你要的结果，而不是只执行一次命令',
    desiredIntro: '不再说“现在启动三份”，而是保存一个长期目标：“健康副本应该始终是 3”。',
    desiredLabel: '期望状态',
    currentLabel: '当前状态',
    compareContinuously: 'Kubernetes 会持续比较这两个数字',
    desiredConclusion: '期望状态，就是 Kubernetes 一直反复检查的承诺。',
    gapTitle: '故障发生后，差值一眼就能看见',
    gapIntro: '一个副本消失。目标仍然是 3，但现实只剩 2。',
    missing: '缺少的一份',
    gapLabel: '需要修复的差值',
    gapConclusion: '自愈从“期望状态”和“当前状态”不一致开始。',
    controllerTitle: '控制循环负责把差值补回来',
    controllerIntro: '控制器并不是魔法。它会通过 Kubernetes API，反复执行三个小动作。',
    controller: 'Controller Manager',
    observe: '观察',
    observeDetail: '通过 API Server 读取期望状态和当前状态',
    compare: '比较',
    compareDetail: '想要 3，实际 2 — 少了一份',
    act: '行动',
    actDetail: '创建一个新的 Pending Pod 对象',
    controllerBoundary: '它不负责选择 Node，也不负责启动容器。',
    controllerConclusion: 'Kubernetes 自愈就是：观察 → 比较 → 行动 → 再观察。',
  },
};

export function beginnerProblemStageKindForStep(
  step: Pick<CompiledStep, 'lessonId' | 'stepId'>,
): BeginnerProblemStageKind | undefined {
  if (step.lessonId !== 'why-kubernetes-exists') return undefined;
  switch (step.stepId) {
    case 'image-packages-the-app':
      return 'single-container';
    case 'declare-three-replicas':
      return 'manual-replicas';
    case 'three-replaceable-pods':
      return 'desired-state';
    case 'one-pod-is-lost':
      return 'replica-gap';
    case 'controller-restores-count':
      return 'controller-loop';
    default:
      return undefined;
  }
}

function DesiredStateStage({ t }: { readonly t: BeginnerProblemStageCopy }) {
  return (
    <>
      <div className="beginner-problem-stage__heading">
        <h2>{t.desiredTitle}</h2>
        <p>{t.desiredIntro}</p>
      </div>
      <div className="beginner-state-comparison" aria-hidden="true">
        <div className="beginner-state-card is-target">
          <Target size={27} />
          <span>{t.desiredLabel}</span>
          <strong>3</strong>
        </div>
        <div className="beginner-compare-bridge">
          <RefreshCw size={25} />
          <span>{t.compareContinuously}</span>
        </div>
        <div className="beginner-state-card is-current">
          <Activity size={27} />
          <span>{t.currentLabel}</span>
          <strong>3</strong>
          <CheckCircle2 size={19} />
        </div>
      </div>
      <p className="beginner-problem-conclusion">{t.desiredConclusion}</p>
    </>
  );
}

function ReplicaGapStage({ t }: { readonly t: BeginnerProblemStageCopy }) {
  return (
    <>
      <div className="beginner-problem-stage__heading">
        <h2>{t.gapTitle}</h2>
        <p>{t.gapIntro}</p>
      </div>
      <div className="beginner-gap-visual" aria-hidden="true">
        <div className="beginner-state-card is-target">
          <Target size={27} />
          <span>{t.desiredLabel}</span>
          <strong>3</strong>
        </div>
        <div className="beginner-gap-equation">
          <div className="beginner-replica-slots">
            <span className="is-present">
              <Box size={21} />
            </span>
            <span className="is-present">
              <Box size={21} />
            </span>
            <span className="is-missing">
              <Box size={21} />
              <small>{t.missing}</small>
            </span>
          </div>
          <strong>{t.gapLabel}: 1</strong>
        </div>
        <div className="beginner-state-card is-current has-gap">
          <Activity size={27} />
          <span>{t.currentLabel}</span>
          <strong>2</strong>
        </div>
      </div>
      <p className="beginner-problem-conclusion is-warning">{t.gapConclusion}</p>
    </>
  );
}

function ControllerLoopStage({ t }: { readonly t: BeginnerProblemStageCopy }) {
  const phases = [
    { icon: <Eye size={24} />, title: t.observe, detail: t.observeDetail },
    { icon: <GitCompareArrows size={24} />, title: t.compare, detail: t.compareDetail },
    { icon: <PlusCircle size={24} />, title: t.act, detail: t.actDetail },
  ] as const;
  return (
    <>
      <div className="beginner-problem-stage__heading">
        <h2>{t.controllerTitle}</h2>
        <p>{t.controllerIntro}</p>
      </div>
      <div className="beginner-controller-card">
        <div className="beginner-controller-card__title">
          <RefreshCw size={24} aria-hidden="true" />
          <strong>{t.controller}</strong>
        </div>
        <div className="beginner-controller-phases">
          {phases.map((phase, index) => (
            <div className="beginner-controller-phase" key={phase.title}>
              <span className="beginner-controller-phase__number">{index + 1}</span>
              <span className="beginner-controller-phase__icon">{phase.icon}</span>
              <strong>{phase.title}</strong>
              <p>{phase.detail}</p>
            </div>
          ))}
        </div>
        <p className="beginner-controller-boundary">{t.controllerBoundary}</p>
      </div>
      <p className="beginner-problem-conclusion">{t.controllerConclusion}</p>
    </>
  );
}

export function BeginnerProblemStage({
  kind,
  locale,
  ariaLabel,
  onViewportClassChange,
}: BeginnerProblemStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const t = copy[locale];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !onViewportClassChange) return;
    const publish = () => onViewportClassChange(host.clientWidth <= 720 ? 'mobile' : 'desktop');
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(host);
    return () => observer.disconnect();
  }, [onViewportClassChange]);

  return (
    <div
      ref={hostRef}
      className="beginner-problem-stage"
      role="img"
      aria-label={ariaLabel}
      data-testid="beginner-problem-stage"
      data-concept={kind}
    >
      <div className="beginner-problem-stage__inner">
        <span className="beginner-problem-stage__eyebrow">{t.before}</span>
        {kind === 'single-container' ? (
          <>
            <div className="beginner-problem-stage__heading">
              <h2>{t.singleTitle}</h2>
              <p>{t.singleIntro}</p>
            </div>
            <div className="beginner-single-flow" aria-hidden="true">
              <div className="beginner-runtime-card">
                <ServerCog size={24} />
                <span>{t.runtime}</span>
                <div className="beginner-container-card">
                  <Box size={27} />
                  <strong>{t.container}</strong>
                </div>
              </div>
              <div className="beginner-flow-arrow">→</div>
              <div className="beginner-running-card">
                <CheckCircle2 size={32} />
                <strong>{t.running}</strong>
              </div>
            </div>
            <div className="beginner-problem-question">
              <CircleHelp size={22} aria-hidden="true" />
              <span>{t.singleQuestion}</span>
            </div>
            <p className="beginner-problem-conclusion">{t.singleConclusion}</p>
          </>
        ) : kind === 'manual-replicas' ? (
          <>
            <div className="beginner-problem-stage__heading">
              <h2>{t.replicasTitle}</h2>
              <p>{t.replicasIntro}</p>
            </div>
            <div className="beginner-replica-row" aria-hidden="true">
              {[1, 2, 3].map((replica) => (
                <div className="beginner-replica-card" key={replica}>
                  <Box size={25} />
                  <strong>api #{replica}</strong>
                </div>
              ))}
            </div>
            <div className="beginner-human-controller">
              <div className="beginner-human-controller__person">
                <UserRound size={28} aria-hidden="true" />
                <strong>{t.you}</strong>
              </div>
              <div className="beginner-human-controller__chores">
                {t.chores.map((chore, index) => (
                  <span key={chore}>
                    <b>{index + 1}</b>
                    {chore}
                  </span>
                ))}
              </div>
            </div>
            <p className="beginner-problem-conclusion">{t.replicasConclusion}</p>
          </>
        ) : kind === 'desired-state' ? (
          <DesiredStateStage t={t} />
        ) : kind === 'replica-gap' ? (
          <ReplicaGapStage t={t} />
        ) : (
          <ControllerLoopStage t={t} />
        )}
      </div>
    </div>
  );
}
