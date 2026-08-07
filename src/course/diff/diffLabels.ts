import type { LocalizedText, WorldEntity } from '../../world/types';

const text = (en: string, ja: string, zhCN: string): LocalizedText => ({
  en,
  ja,
  'zh-CN': zhCN,
});

export const diffLabels = {
  entityIdentity: text('Object identity', 'オブジェクト ID', '对象身份'),
  podIdentity: text('Pod identity', 'Pod ID', 'Pod 身份'),
  containerIdentity: text('Container status slot', 'Container 状態スロット', '容器状态槽'),
  podUid: text('Pod UID', 'Pod UID', 'Pod UID'),
  node: text('Node', 'Node', 'Node'),
  podPhase: text('Pod phase', 'Pod phase', 'Pod 阶段'),
  podScheduled: text('PodScheduled', 'PodScheduled', 'PodScheduled'),
  initialized: text('Initialized', 'Initialized', 'Initialized'),
  containersReady: text('ContainersReady', 'ContainersReady', 'ContainersReady'),
  podReady: text('Pod Ready', 'Pod Ready', 'Pod Ready'),
  containerStatus: text('Container state', 'Container state', '容器状态'),
  containerId: text('Container ID', 'Container ID', 'Container ID'),
  containerReady: text('Container Ready', 'Container Ready', 'Container Ready'),
  containerStarted: text('Container Started', 'Container Started', 'Container Started'),
  terminationReason: text('Last termination reason', '直前の終了理由', '上次终止原因'),
  terminationExitCode: text('Last termination exit code', '直前の終了コード', '上次终止退出码'),
  entityStatus: text('Status', 'Status', '状态'),
  restartCount: text('Restart count', 'Container 再起動回数', '容器重启次数'),
  replicaCounts: text(
    'ReplicaSet SPEC / OBSERVED / READY',
    'ReplicaSet SPEC / OBSERVED / READY',
    'ReplicaSet SPEC / OBSERVED / READY',
  ),
  name: text('Name', '名前', '名称'),
  relation: text('Relation', '関係', '关系'),
} as const satisfies Record<string, LocalizedText>;

export function identityLabel(entity: WorldEntity): LocalizedText {
  if (entity.kind === 'Pod') return diffLabels.podIdentity;
  if (entity.kind === 'Container') return diffLabels.containerIdentity;
  return diffLabels.entityIdentity;
}

export function labelForPath(entity: WorldEntity, path: string): LocalizedText | undefined {
  switch (path) {
    case '/data/uid':
      return diffLabels.podUid;
    case '/data/nodeName':
      return diffLabels.node;
    case '/data/phase':
      return diffLabels.podPhase;
    case '/data/restartCount':
      return diffLabels.restartCount;
    case '/data/containerID':
      return diffLabels.containerId;
    case '/data/state/kind':
      return diffLabels.containerStatus;
    case '/data/ready':
      return entity.kind === 'Pod' ? diffLabels.podReady : diffLabels.containerReady;
    case '/data/started':
      return diffLabels.containerStarted;
    case '/data/lastState/reason':
      return diffLabels.terminationReason;
    case '/data/lastState/exitCode':
      return diffLabels.terminationExitCode;
    case '/data/conditions/podScheduled':
      return diffLabels.podScheduled;
    case '/data/conditions/initialized':
      return diffLabels.initialized;
    case '/data/conditions/containersReady':
      return diffLabels.containersReady;
    case '/data/conditions/ready':
      return diffLabels.podReady;
    case '/data/specReplicas':
    case '/data/statusReplicas':
    case '/data/readyReplicas':
    case '/data/replicas':
      return diffLabels.replicaCounts;
    case '/name':
      return diffLabels.name;
    default:
      return undefined;
  }
}
