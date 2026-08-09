import type { ViewMode } from '../../course/types';
import type { EntityId, WorldEntity } from '../../world/types';

export type LayoutContractIssue =
  | {
      readonly code: 'missing-role';
      readonly role: string;
      readonly expectedKinds?: readonly string[];
    }
  | {
      readonly code: 'ambiguous-role';
      readonly role: string;
      readonly entityIds: readonly EntityId[];
    }
  | {
      readonly code: 'unassigned-visible-entity';
      readonly entityIds: readonly EntityId[];
      readonly kinds: readonly string[];
    }
  | {
      readonly code: 'missing-parent';
      readonly entityId: EntityId;
      readonly expectedParentKind: string;
    };

export interface LayoutContractErrorOptions {
  readonly view: ViewMode;
  readonly scenarioId: string;
  readonly issues: readonly LayoutContractIssue[];
}

const describeIssue = (issue: LayoutContractIssue): string => {
  switch (issue.code) {
    case 'missing-role':
      return `missing role "${issue.role}"${
        issue.expectedKinds?.length ? ` (${issue.expectedKinds.join(' | ')})` : ''
      }`;
    case 'ambiguous-role':
      return `ambiguous role "${issue.role}": ${issue.entityIds.join(', ')}`;
    case 'unassigned-visible-entity':
      return `unassigned visible entities: ${issue.entityIds
        .map((id, index) => `${id} [${issue.kinds[index] ?? 'unknown'}]`)
        .join(', ')}`;
    case 'missing-parent':
      return `entity "${issue.entityId}" has no visible ${issue.expectedParentKind} parent`;
  }
};

/**
 * Raised when a guided semantic view does not satisfy the layout's explicit teaching contract.
 *
 * Guided layouts must fail loudly instead of silently falling back to an unrelated projection or
 * dropping unknown entities into a generic remainder row. The error is intentionally structured so
 * content validation and screenshot tooling can report the exact missing/ambiguous role.
 */
export class LayoutContractError extends Error {
  public readonly view: ViewMode;
  public readonly scenarioId: string;
  public readonly issues: readonly LayoutContractIssue[];

  public constructor(options: LayoutContractErrorOptions) {
    const detail = options.issues.map(describeIssue).join('; ');
    super(`Layout contract failed for ${options.view} in ${options.scenarioId}: ${detail}`);
    this.name = 'LayoutContractError';
    this.view = options.view;
    this.scenarioId = options.scenarioId;
    this.issues = options.issues;
  }
}

export const unassignedIssue = (
  entities: readonly WorldEntity[],
): Extract<LayoutContractIssue, { readonly code: 'unassigned-visible-entity' }> => ({
  code: 'unassigned-visible-entity',
  entityIds: entities.map((entity) => entity.id),
  kinds: entities.map((entity) => entity.kind),
});
