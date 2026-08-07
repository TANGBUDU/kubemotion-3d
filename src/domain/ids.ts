import type { EntityId, RelationId, SourceId } from './types';

export const entityId = (value: string): EntityId => value as EntityId;
export const relationId = (value: string): RelationId => value as RelationId;
export const sourceId = (value: string): SourceId => value as SourceId;
