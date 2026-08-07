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
  '/data/restartCount': 110,
  '/data/instanceGeneration': 108,
  '/identity': 106,
  '/data/uid': 104,
  '/data/nodeName': 102,
  '/data/endpoints': 100,
  '/data/clusterIP': 98,
  '/data/ports/0': 96,
  '/data/replicas': 94,
  '/data/phase': 78,
  '/status': 76,
};

function prioritizeContextEvidence(rows: readonly EvidenceRow[]): readonly EvidenceRow[] {
  const hasRuntimeCounterChange = rows.some(
    (row) =>
      row.change !== 'unchanged' &&
      (row.path === '/data/restartCount' || row.path === '/data/instanceGeneration'),
  );
  const changedRowBonus = hasRuntimeCounterChange ? 20 : 200;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftPriority =
        (left.row.change === 'unchanged' ? 0 : changedRowBonus) +
        (evidencePathPriority[left.row.path ?? ''] ?? 0);
      const rightPriority =
        (right.row.change === 'unchanged' ? 0 : changedRowBonus) +
        (evidencePathPriority[right.row.path ?? ''] ?? 0);
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
