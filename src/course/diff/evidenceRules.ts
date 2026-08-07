import type { EvidenceChangeKind, EvidenceRow } from '../types';
import type { EntityId, LocalizedText, WorldEntity, WorldSnapshot } from '../../world/types';
import { getContainerData, getPodData, getReplicaSetData } from '../../world';
import { diffLabels, identityLabel, labelForPath } from './diffLabels';

const sameText = (value: string): LocalizedText => ({
  en: value,
  ja: value,
  'zh-CN': value,
});

const absentText: LocalizedText = { en: 'Absent', ja: 'なし', 'zh-CN': '不存在' };
const unscheduledText: LocalizedText = {
  en: 'Unscheduled',
  ja: '未スケジュール',
  'zh-CN': '未调度',
};
const clusterIpLabel: LocalizedText = {
  en: 'Service ClusterIP',
  ja: 'Service ClusterIP',
  'zh-CN': 'Service ClusterIP',
};
const servicePortLabel: LocalizedText = {
  en: 'Service port',
  ja: 'Service ポート',
  'zh-CN': 'Service 端口',
};
const endpointReadinessLabel: LocalizedText = {
  en: 'Endpoint readiness',
  ja: 'Endpoint readiness',
  'zh-CN': 'Endpoint 就绪',
};

function localized(en: string, ja: string, zhCN: string): LocalizedText {
  return { en, ja, 'zh-CN': zhCN };
}

function valueText(value: unknown, path: string): LocalizedText {
  if (value === undefined && path === '/data/nodeName') return unscheduledText;
  if (value === undefined || value === null) return absentText;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sameText(String(value));
  }
  return sameText(JSON.stringify(value));
}

function pointerValue(entity: WorldEntity, pointer: string): unknown {
  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current: unknown = entity;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[part];
  }
  return current;
}

function row(
  entity: WorldEntity,
  path: string,
  change: EvidenceChangeKind,
  before: LocalizedText | undefined,
  after: LocalizedText | undefined,
  label = labelForPath(entity, path) ?? diffLabels.entityStatus,
): EvidenceRow {
  const base = {
    id: `${entity.id}:${path}:${change}`,
    entityId: entity.id,
    change,
    label,
    path,
  };
  return {
    ...base,
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
  };
}

function identityValue(entity: WorldEntity): LocalizedText {
  if (entity.kind === 'Pod') {
    const data = getPodData(entity);
    return sameText(data.uid);
  }
  return sameText(entity.name);
}

function replicaValue(entity: WorldEntity): LocalizedText {
  const data = getReplicaSetData(entity);
  return sameText(`D${data.desiredReplicas} · C${data.currentReplicas} · R${data.readyReplicas}`);
}

function servicePortValue(entity: WorldEntity): LocalizedText {
  const ports = entity.data.ports;
  const first = Array.isArray(ports) ? ports[0] : undefined;
  if (!first || typeof first !== 'object' || Array.isArray(first)) return sameText('Unspecified');
  const record = first as Readonly<Record<string, unknown>>;
  const protocol = typeof record.protocol === 'string' ? record.protocol : 'TCP';
  const port = typeof record.port === 'number' ? record.port : '?';
  const targetPort =
    typeof record.targetPort === 'number' || typeof record.targetPort === 'string'
      ? record.targetPort
      : '?';
  return sameText(`${protocol} ${port} → target ${targetPort}`);
}

function endpointReadinessValue(entity: WorldEntity): LocalizedText {
  const endpoints = Array.isArray(entity.data.endpoints) ? entity.data.endpoints : [];
  const readyCount = endpoints.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const conditions = (candidate as Readonly<Record<string, unknown>>).conditions;
    return (
      conditions !== null &&
      typeof conditions === 'object' &&
      !Array.isArray(conditions) &&
      (conditions as Readonly<Record<string, unknown>>).ready === true
    );
  }).length;
  return localized(
    `${readyCount}/${endpoints.length} Ready`,
    `Ready ${readyCount}/${endpoints.length}`,
    `就绪 ${readyCount}/${endpoints.length}`,
  );
}

export function snapshotEvidence(entity: WorldEntity): readonly EvidenceRow[] {
  if (entity.kind === 'Pod') {
    const data = getPodData(entity);
    return [
      row(entity, '/data/uid', 'unchanged', undefined, valueText(data.uid, '/data/uid')),
      row(
        entity,
        '/data/nodeName',
        'unchanged',
        undefined,
        valueText(data.nodeName, '/data/nodeName'),
      ),
      row(entity, '/data/phase', 'unchanged', undefined, valueText(data.phase, '/data/phase')),
    ];
  }
  if (entity.kind === 'Container') {
    const data = getContainerData(entity);
    const counterRows = [
      row(
        entity,
        '/data/restartCount',
        'unchanged',
        undefined,
        valueText(data.restartCount, '/data/restartCount'),
      ),
      row(
        entity,
        '/data/instanceGeneration',
        'unchanged',
        undefined,
        valueText(data.instanceGeneration, '/data/instanceGeneration'),
      ),
    ];
    const statusRow = row(
      entity,
      '/status',
      'unchanged',
      undefined,
      valueText(entity.status, '/status'),
    );
    return entity.status === 'running' ? [...counterRows, statusRow] : [statusRow, ...counterRows];
  }
  if (entity.kind === 'ReplicaSet') {
    return [row(entity, '/data/replicas', 'unchanged', undefined, replicaValue(entity))];
  }
  if (entity.kind === 'Service') {
    return [
      row(
        entity,
        '/data/clusterIP',
        'unchanged',
        undefined,
        valueText(entity.data.clusterIP, '/data/clusterIP'),
        clusterIpLabel,
      ),
      row(
        entity,
        '/data/ports/0',
        'unchanged',
        undefined,
        servicePortValue(entity),
        servicePortLabel,
      ),
    ];
  }
  if (entity.kind === 'EndpointSlice') {
    return [
      row(
        entity,
        '/data/endpoints',
        'unchanged',
        undefined,
        endpointReadinessValue(entity),
        endpointReadinessLabel,
      ),
    ];
  }
  return [row(entity, '/status', 'unchanged', undefined, valueText(entity.status, '/status'))];
}

export function addedEntityEvidence(entity: WorldEntity): EvidenceRow {
  return row(
    entity,
    '/identity',
    'added',
    absentText,
    identityValue(entity),
    identityLabel(entity),
  );
}

export function removedEntityEvidence(entity: WorldEntity): EvidenceRow {
  return row(
    entity,
    '/identity',
    'removed',
    identityValue(entity),
    absentText,
    identityLabel(entity),
  );
}

export function updatedEntityEvidence(
  before: WorldEntity,
  after: WorldEntity,
  changedPaths: readonly string[],
): readonly EvidenceRow[] {
  if (
    after.kind === 'EndpointSlice' &&
    changedPaths.some((path) => path === '/data/endpoints' || path.startsWith('/data/endpoints/'))
  ) {
    return [
      row(
        after,
        '/data/endpoints',
        'changed',
        endpointReadinessValue(before),
        endpointReadinessValue(after),
        endpointReadinessLabel,
      ),
    ];
  }
  if (
    after.kind === 'ReplicaSet' &&
    changedPaths.some((path) =>
      ['/data/desiredReplicas', '/data/currentReplicas', '/data/readyReplicas'].includes(path),
    )
  ) {
    return [row(after, '/data/replicas', 'changed', replicaValue(before), replicaValue(after))];
  }

  return changedPaths.flatMap((path) => {
    const label = labelForPath(after, path);
    if (!label) return [];
    return [
      row(
        after,
        path,
        'changed',
        valueText(pointerValue(before, path), path),
        valueText(pointerValue(after, path), path),
        label,
      ),
    ];
  });
}

export function entityForEvidence(
  id: EntityId,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): WorldEntity | undefined {
  return world.entities[id] ?? beforeWorld.entities[id];
}
