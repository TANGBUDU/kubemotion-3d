import { deepFreeze } from '../../world';
import type { WorldDiff, WorldSnapshot } from '../../world/types';
import type { EvidenceRequest, EvidenceRow } from '../types';
import {
  addedEntityEvidence,
  entityForEvidence,
  removedEntityEvidence,
  snapshotEvidence,
  updatedEntityEvidence,
} from './evidenceRules';

const MAX_EVIDENCE_ROWS = 8;

function selected(request: EvidenceRequest): ReadonlySet<string> {
  return new Set(request.entityIds);
}

function deduplicate(rows: readonly EvidenceRow[]): readonly EvidenceRow[] {
  const byKey = new Map<string, EvidenceRow>();
  for (const row of rows) {
    const key = `${row.entityId}:${row.path ?? row.id}`;
    const existing = byKey.get(key);
    if (!existing || (existing.change === 'unchanged' && row.change !== 'unchanged')) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

const evidencePathPriority: Readonly<Record<string, number>> = {
  '/data/containerID': 140,
  '/data/restartCount': 138,
  '/data/lastState/reason': 136,
  '/data/lastState/exitCode': 134,
  '/data/conditions/ready': 132,
  '/data/conditions/containersReady': 130,
  '/data/replicas': 128,
  '/data/state/kind': 126,
  '/data/phase': 124,
  '/data/uid': 122,
  '/data/nodeName': 120,
  '/data/ready': 108,
  '/data/started': 106,
  '/identity': 104,
  '/data/endpoints': 100,
  '/data/clusterIP': 98,
  '/data/ports/0': 96,
  '/status': 76,
};

function prioritizeContextEvidence(rows: readonly EvidenceRow[]): readonly EvidenceRow[] {
  const hasContainerIdChange = rows.some(
    (row) => row.change !== 'unchanged' && row.path === '/data/containerID',
  );
  const hasContainerLifecycleChange = rows.some(
    (row) =>
      row.change !== 'unchanged' &&
      ['/data/containerID', '/data/restartCount', '/data/state/kind'].includes(row.path ?? ''),
  );
  const restartPriority: Readonly<Record<string, number>> = {
    '/data/containerID': 220,
    '/data/restartCount': 218,
    '/data/lastState/reason': 216,
    '/data/lastState/exitCode': 214,
    '/data/conditions/ready': 212,
    '/data/replicas': 210,
    '/data/uid': 208,
    '/data/nodeName': 206,
  };
  const changedRowBonus = hasContainerIdChange ? 10 : hasContainerLifecycleChange ? 20 : 200;
  const relevantRows =
    hasContainerLifecycleChange && !hasContainerIdChange
      ? rows.filter(
          (row) =>
            ![
              '/data/containerID',
              '/data/restartCount',
              '/data/ready',
              '/data/started',
              '/status',
            ].includes(row.path ?? ''),
        )
      : rows;
  return relevantRows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftPriority =
        (left.row.change === 'unchanged' ? 0 : changedRowBonus) +
        (hasContainerIdChange
          ? (restartPriority[left.row.path ?? ''] ?? evidencePathPriority[left.row.path ?? ''] ?? 0)
          : (evidencePathPriority[left.row.path ?? ''] ?? 0));
      const rightPriority =
        (right.row.change === 'unchanged' ? 0 : changedRowBonus) +
        (hasContainerIdChange
          ? (restartPriority[right.row.path ?? ''] ??
            evidencePathPriority[right.row.path ?? ''] ??
            0)
          : (evidencePathPriority[right.row.path ?? ''] ?? 0));
      return rightPriority - leftPriority || left.index - right.index;
    })
    .map(({ row }) => row);
}

function changedRows(request: EvidenceRequest, diff: WorldDiff): readonly EvidenceRow[] {
  const ids = selected(request);
  const rows: EvidenceRow[] = [];
  for (const entity of diff.addedEntities) {
    if (ids.has(entity.id)) rows.push(addedEntityEvidence(entity));
  }
  for (const entity of diff.removedEntities) {
    if (ids.has(entity.id)) rows.push(removedEntityEvidence(entity));
  }
  for (const update of diff.updatedEntities) {
    if (ids.has(update.id)) {
      rows.push(...updatedEntityEvidence(update.before, update.after, update.changedPaths));
    }
  }
  return rows;
}

function contextRows(
  request: EvidenceRequest,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): readonly EvidenceRow[] {
  return request.entityIds.flatMap((id) => {
    const entity = entityForEvidence(id, beforeWorld, world);
    return entity ? snapshotEvidence(entity) : [];
  });
}

function validateRequest(
  request: EvidenceRequest,
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
): void {
  if (new Set(request.entityIds).size !== request.entityIds.length) {
    throw new Error('Evidence request contains duplicate entity IDs');
  }
  for (const id of request.entityIds) {
    const valid =
      request.mode === 'snapshot'
        ? world.entities[id] !== undefined
        : beforeWorld.entities[id] !== undefined || world.entities[id] !== undefined;
    if (!valid) throw new Error(`Evidence request references missing entity: ${id}`);
  }
}

export function humanizeWorldDiff(
  beforeWorld: WorldSnapshot,
  world: WorldSnapshot,
  diff: WorldDiff,
  request: EvidenceRequest,
): readonly EvidenceRow[] {
  validateRequest(request, beforeWorld, world);
  if (request.mode === 'none') return deepFreeze([]);

  const rows =
    request.mode === 'snapshot'
      ? contextRows(request, beforeWorld, world)
      : request.mode === 'diff'
        ? changedRows(request, diff)
        : [...changedRows(request, diff), ...contextRows(request, beforeWorld, world)];
  const deduplicated = deduplicate(rows);
  const ordered =
    request.mode === 'diff-with-context' ? prioritizeContextEvidence(deduplicated) : deduplicated;
  return deepFreeze(ordered.slice(0, MAX_EVIDENCE_ROWS));
}
