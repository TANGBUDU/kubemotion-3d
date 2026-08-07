import type { LocalizedText, WorldEntity } from '../../world/types';

const text = (en: string, ja: string, zhCN: string): LocalizedText => ({
  en,
  ja,
  'zh-CN': zhCN,
});

export const diffLabels = {
  entityIdentity: text('Object identity', 'オブジェクト ID', '对象身份'),
  podIdentity: text('Pod identity', 'Pod ID', 'Pod 身份'),
  containerIdentity: text('Container identity', 'Container ID', '容器身份'),
  podUid: text('Pod UID', 'Pod UID', 'Pod UID'),
  node: text('Node', 'Node', 'Node'),
  podPhase: text('Pod phase', 'Pod phase', 'Pod 阶段'),
  podStatus: text('Pod status', 'Pod status', 'Pod 状态'),
  containerStatus: text('Container status', 'Container status', '容器状态'),
  entityStatus: text('Status', 'Status', '状态'),
  restartCount: text('Restart count', 'Container 再起動回数', '容器重启次数'),
  containerGeneration: text('Generation', 'Container 世代', '容器代次'),
  replicaCounts: text('ReplicaSet D/C/R', 'ReplicaSet D/C/R', 'ReplicaSet 期望/当前/就绪'),
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
    case '/data/instanceGeneration':
      return diffLabels.containerGeneration;
    case '/data/desiredReplicas':
    case '/data/currentReplicas':
    case '/data/readyReplicas':
    case '/data/replicas':
      return diffLabels.replicaCounts;
    case '/name':
      return diffLabels.name;
    case '/status':
      if (entity.kind === 'Pod') return diffLabels.podStatus;
      if (entity.kind === 'Container') return diffLabels.containerStatus;
      return diffLabels.entityStatus;
    default:
      return undefined;
  }
}
