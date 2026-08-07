import { isContainerData, isPlainRecord, isPodData, isReplicaSetData } from './dataGuards';
import {
  VISUAL_ARCHETYPES,
  WORLD_ENTITY_CATEGORIES,
  WORLD_ENTITY_STATUSES,
  WORLD_RELATION_SEMANTICS,
  WORLD_RELATION_TYPES,
  type WorldEntity,
  type WorldRelation,
  type WorldSnapshot,
} from './types';

export type WorldValidationCode =
  | 'invalid-type'
  | 'invalid-value'
  | 'missing-field'
  | 'unexpected-field'
  | 'non-serializable'
  | 'record-key-mismatch'
  | 'dangling-relation'
  | 'invalid-kubernetes-data'
  | 'invalid-composition'
  | 'invalid-placement';

export interface WorldValidationIssue {
  readonly code: WorldValidationCode;
  readonly path: string;
  readonly message: string;
}

export class WorldValidationError extends Error {
  public readonly issues: readonly WorldValidationIssue[];

  public constructor(issues: readonly WorldValidationIssue[]) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    super(`World snapshot validation failed with ${issues.length} issue(s).\n${detail}`);
    this.name = 'WorldValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

const entityKeys = new Set([
  'id',
  'category',
  'kind',
  'name',
  'namespace',
  'labels',
  'status',
  'data',
  'title',
  'summary',
  'sourceIds',
  'visual',
]);

const relationKeys = new Set([
  'id',
  'type',
  'from',
  'to',
  'directed',
  'semantic',
  'title',
  'sourceIds',
  'data',
]);

const snapshotKeys = new Set(['schemaVersion', 'scenarioId', 'revision', 'entities', 'relations']);
const localizedTextKeys = new Set(['en', 'ja', 'zh-CN']);
const visualKeys = new Set(['archetype', 'size', 'group']);
const visualSizes = new Set(['xs', 'sm', 'md', 'lg', 'xl']);

const addIssue = (
  issues: WorldValidationIssue[],
  code: WorldValidationCode,
  path: string,
  message: string,
): void => {
  issues.push({ code, path, message });
};

const propertyPath = (base: string, key: string): string =>
  /^[A-Za-z_$][\w$]*$/u.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;

const requireFields = (
  record: Record<string, unknown>,
  fields: readonly string[],
  path: string,
  issues: WorldValidationIssue[],
): void => {
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) {
      addIssue(
        issues,
        'missing-field',
        propertyPath(path, field),
        `Missing required field "${field}".`,
      );
    }
  }
};

const rejectUnexpectedFields = (
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: WorldValidationIssue[],
): void => {
  for (const key of Object.keys(record).sort()) {
    if (!allowed.has(key)) {
      addIssue(issues, 'unexpected-field', propertyPath(path, key), `Unexpected field "${key}".`);
    }
  }
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isOneOf = <Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] => typeof value === 'string' && values.includes(value);

const validateLocalizedText = (
  value: unknown,
  path: string,
  issues: WorldValidationIssue[],
): void => {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a localized text object.');
    return;
  }

  rejectUnexpectedFields(value, localizedTextKeys, path, issues);
  requireFields(value, ['en', 'ja', 'zh-CN'], path, issues);

  for (const locale of ['en', 'ja', 'zh-CN'] as const) {
    if (Object.hasOwn(value, locale) && !isNonEmptyString(value[locale])) {
      addIssue(
        issues,
        'invalid-value',
        propertyPath(path, locale),
        'Localized text must be a non-empty string.',
      );
    }
  }
};

const validateSourceIds = (value: unknown, path: string, issues: WorldValidationIssue[]): void => {
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected an array of source IDs.');
    return;
  }

  const seen = new Set<string>();
  value.forEach((sourceId: unknown, index: number) => {
    if (!isNonEmptyString(sourceId)) {
      addIssue(issues, 'invalid-value', `${path}[${index}]`, 'Source ID must be non-empty.');
      return;
    }
    if (seen.has(sourceId)) {
      addIssue(issues, 'invalid-value', `${path}[${index}]`, `Duplicate source ID "${sourceId}".`);
    }
    seen.add(sourceId);
  });
};

const validateSerializable = (
  value: unknown,
  path: string,
  issues: WorldValidationIssue[],
  ancestors: Set<object>,
): void => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      addIssue(issues, 'non-serializable', path, 'Numbers must be finite.');
    }
    return;
  }

  if (typeof value !== 'object') {
    addIssue(
      issues,
      'non-serializable',
      path,
      `Values of type "${typeof value}" are not serializable.`,
    );
    return;
  }

  if (ancestors.has(value)) {
    addIssue(issues, 'non-serializable', path, 'Cyclic values are not serializable.');
    return;
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        addIssue(issues, 'non-serializable', `${path}[${index}]`, 'Sparse arrays are forbidden.');
      } else {
        validateSerializable(value[index], `${path}[${index}]`, issues, ancestors);
      }
    }
  } else if (isPlainRecord(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        addIssue(issues, 'non-serializable', path, 'Symbol keys are not serializable.');
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !('value' in descriptor)) {
        addIssue(
          issues,
          'non-serializable',
          propertyPath(path, key),
          'Accessor properties are forbidden in serializable data.',
        );
        continue;
      }
      validateSerializable(descriptor.value, propertyPath(path, key), issues, ancestors);
    }
  } else {
    addIssue(
      issues,
      'non-serializable',
      path,
      'Only primitives, arrays, and plain objects are serializable world data.',
    );
  }

  ancestors.delete(value);
};

const validateLabels = (value: unknown, path: string, issues: WorldValidationIssue[]): void => {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a string-to-string label record.');
    return;
  }

  for (const [key, labelValue] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (key.length === 0 || typeof labelValue !== 'string') {
      addIssue(
        issues,
        'invalid-value',
        propertyPath(path, key),
        'Label keys must be non-empty and values must be strings.',
      );
    }
  }
};

const validateVisual = (value: unknown, path: string, issues: WorldValidationIssue[]): void => {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a visual descriptor object.');
    return;
  }

  rejectUnexpectedFields(value, visualKeys, path, issues);
  requireFields(value, ['archetype'], path, issues);
  if (Object.hasOwn(value, 'archetype') && !isOneOf(value.archetype, VISUAL_ARCHETYPES)) {
    addIssue(issues, 'invalid-value', `${path}.archetype`, 'Unknown visual archetype.');
  }
  if (Object.hasOwn(value, 'size') && !visualSizes.has(String(value.size))) {
    addIssue(issues, 'invalid-value', `${path}.size`, 'Unknown visual size.');
  }
  if (Object.hasOwn(value, 'group') && !isNonEmptyString(value.group)) {
    addIssue(issues, 'invalid-value', `${path}.group`, 'Visual group must be non-empty.');
  }
};

const validateEntity = (
  value: unknown,
  recordId: string,
  path: string,
  issues: WorldValidationIssue[],
): WorldEntity | undefined => {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a world entity object.');
    return undefined;
  }

  rejectUnexpectedFields(value, entityKeys, path, issues);
  requireFields(
    value,
    ['id', 'category', 'kind', 'name', 'status', 'data', 'title', 'summary', 'sourceIds', 'visual'],
    path,
    issues,
  );

  if (!isNonEmptyString(value.id)) {
    addIssue(issues, 'invalid-value', `${path}.id`, 'Entity ID must be a non-empty string.');
  } else if (value.id !== recordId) {
    addIssue(
      issues,
      'record-key-mismatch',
      `${path}.id`,
      `Entity ID "${value.id}" does not match record key "${recordId}".`,
    );
  }

  if (!isOneOf(value.category, WORLD_ENTITY_CATEGORIES)) {
    addIssue(issues, 'invalid-value', `${path}.category`, 'Unknown entity category.');
  }
  if (!isNonEmptyString(value.kind)) {
    addIssue(issues, 'invalid-value', `${path}.kind`, 'Entity kind must be non-empty.');
  }
  if (!isNonEmptyString(value.name)) {
    addIssue(issues, 'invalid-value', `${path}.name`, 'Entity name must be non-empty.');
  }
  if (Object.hasOwn(value, 'namespace') && !isNonEmptyString(value.namespace)) {
    addIssue(issues, 'invalid-value', `${path}.namespace`, 'Namespace must be non-empty.');
  }
  if (Object.hasOwn(value, 'labels')) {
    validateLabels(value.labels, `${path}.labels`, issues);
  }
  if (!isOneOf(value.status, WORLD_ENTITY_STATUSES)) {
    addIssue(issues, 'invalid-value', `${path}.status`, 'Unknown entity status.');
  }
  if (!isPlainRecord(value.data)) {
    addIssue(issues, 'invalid-type', `${path}.data`, 'Entity data must be a plain object.');
  } else {
    validateSerializable(value.data, `${path}.data`, issues, new Set<object>());
  }
  validateLocalizedText(value.title, `${path}.title`, issues);
  validateLocalizedText(value.summary, `${path}.summary`, issues);
  validateSourceIds(value.sourceIds, `${path}.sourceIds`, issues);
  validateVisual(value.visual, `${path}.visual`, issues);

  if (value.kind === 'Pod' && !isPodData(value.data)) {
    addIssue(
      issues,
      'invalid-kubernetes-data',
      `${path}.data`,
      'Pod data must contain uid, phase, and restartPolicy; nodeName is optional.',
    );
  }
  if (
    value.kind === 'Container' &&
    (value.category !== 'runtime-instance' || !isContainerData(value.data))
  ) {
    addIssue(
      issues,
      'invalid-kubernetes-data',
      `${path}.data`,
      'Container must be a runtime-instance with podId, image, restartCount, and instanceGeneration.',
    );
  }
  if (value.kind === 'ReplicaSet' && !isReplicaSetData(value.data)) {
    addIssue(
      issues,
      'invalid-kubernetes-data',
      `${path}.data`,
      'ReplicaSet data must contain valid desired, current, and ready replica counts.',
    );
  }

  return value as unknown as WorldEntity;
};

const validateRelation = (
  value: unknown,
  recordId: string,
  path: string,
  issues: WorldValidationIssue[],
): WorldRelation | undefined => {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a world relation object.');
    return undefined;
  }

  rejectUnexpectedFields(value, relationKeys, path, issues);
  requireFields(
    value,
    ['id', 'type', 'from', 'to', 'directed', 'semantic', 'title', 'sourceIds'],
    path,
    issues,
  );

  if (!isNonEmptyString(value.id)) {
    addIssue(issues, 'invalid-value', `${path}.id`, 'Relation ID must be a non-empty string.');
  } else if (value.id !== recordId) {
    addIssue(
      issues,
      'record-key-mismatch',
      `${path}.id`,
      `Relation ID "${value.id}" does not match record key "${recordId}".`,
    );
  }
  if (!isOneOf(value.type, WORLD_RELATION_TYPES)) {
    addIssue(issues, 'invalid-value', `${path}.type`, 'Unknown relation type.');
  }
  if (!isNonEmptyString(value.from)) {
    addIssue(issues, 'invalid-value', `${path}.from`, 'Relation source must be non-empty.');
  }
  if (!isNonEmptyString(value.to)) {
    addIssue(issues, 'invalid-value', `${path}.to`, 'Relation target must be non-empty.');
  }
  if (typeof value.directed !== 'boolean') {
    addIssue(issues, 'invalid-type', `${path}.directed`, 'Relation directed must be boolean.');
  }
  if (!isOneOf(value.semantic, WORLD_RELATION_SEMANTICS)) {
    addIssue(issues, 'invalid-value', `${path}.semantic`, 'Unknown relation semantic.');
  }
  validateLocalizedText(value.title, `${path}.title`, issues);
  validateSourceIds(value.sourceIds, `${path}.sourceIds`, issues);
  if (Object.hasOwn(value, 'data')) {
    if (!isPlainRecord(value.data)) {
      addIssue(issues, 'invalid-type', `${path}.data`, 'Relation data must be a plain object.');
    } else {
      validateSerializable(value.data, `${path}.data`, issues, new Set<object>());
    }
  }

  const expectedSemantic =
    value.type === 'contains-runtime'
      ? 'composition'
      : value.type === 'scheduled-on'
        ? 'placement'
        : value.type === 'owns'
          ? 'ownership'
          : undefined;
  if (expectedSemantic !== undefined && value.semantic !== expectedSemantic) {
    addIssue(
      issues,
      'invalid-value',
      `${path}.semantic`,
      `Relation type "${String(value.type)}" requires semantic "${expectedSemantic}".`,
    );
  }

  return value as unknown as WorldRelation;
};

const validateCrossReferences = (
  entities: Readonly<Record<string, WorldEntity>>,
  relations: Readonly<Record<string, WorldRelation>>,
  issues: WorldValidationIssue[],
): void => {
  for (const relationId of Object.keys(relations).sort()) {
    const relation = relations[relationId];
    if (relation === undefined) {
      continue;
    }
    if (entities[relation.from] === undefined) {
      addIssue(
        issues,
        'dangling-relation',
        `$.relations[${JSON.stringify(relationId)}].from`,
        `Missing relation endpoint "${relation.from}".`,
      );
    }
    if (entities[relation.to] === undefined) {
      addIssue(
        issues,
        'dangling-relation',
        `$.relations[${JSON.stringify(relationId)}].to`,
        `Missing relation endpoint "${relation.to}".`,
      );
    }
  }

  for (const entityId of Object.keys(entities).sort()) {
    const entity = entities[entityId];
    if (entity === undefined) {
      continue;
    }

    if (entity.kind === 'Container' && isContainerData(entity.data)) {
      const pod = entities[entity.data.podId];
      if (pod === undefined || pod.kind !== 'Pod') {
        addIssue(
          issues,
          'invalid-composition',
          `$.entities[${JSON.stringify(entityId)}].data.podId`,
          `Container parent "${entity.data.podId}" must be an existing Pod.`,
        );
        continue;
      }

      const hasComposition = Object.values(relations).some(
        (relation) =>
          relation.type === 'contains-runtime' &&
          relation.semantic === 'composition' &&
          relation.from === pod.id &&
          relation.to === entity.id,
      );
      if (!hasComposition) {
        addIssue(
          issues,
          'invalid-composition',
          `$.entities[${JSON.stringify(entityId)}]`,
          `Container "${entityId}" requires a Pod-to-Container composition relation.`,
        );
      }

      if (
        entity.namespace !== undefined &&
        pod.namespace !== undefined &&
        entity.namespace !== pod.namespace
      ) {
        addIssue(
          issues,
          'invalid-composition',
          `$.entities[${JSON.stringify(entityId)}].namespace`,
          'Container namespace must match its parent Pod namespace.',
        );
      }
    }

    if (entity.kind === 'Pod' && isPodData(entity.data)) {
      const placementRelations = Object.values(relations).filter(
        (relation) => relation.type === 'scheduled-on' && relation.from === entity.id,
      );
      if (entity.data.nodeName === undefined && placementRelations.length > 0) {
        addIssue(
          issues,
          'invalid-placement',
          `$.entities[${JSON.stringify(entityId)}].data.nodeName`,
          'An unscheduled Pod cannot have a scheduled-on relation.',
        );
      }
      if (entity.data.nodeName !== undefined) {
        const hasMatchingNode = placementRelations.some((relation) => {
          const target = entities[relation.to];
          return (
            target !== undefined &&
            target.kind === 'Node' &&
            (target.name === entity.data.nodeName || target.id === entity.data.nodeName)
          );
        });
        if (!hasMatchingNode) {
          addIssue(
            issues,
            'invalid-placement',
            `$.entities[${JSON.stringify(entityId)}].data.nodeName`,
            `Pod nodeName "${entity.data.nodeName}" requires a matching scheduled-on relation.`,
          );
        }
      }
    }
  }
};

export const getWorldSnapshotValidationIssues = (
  value: unknown,
): readonly WorldValidationIssue[] => {
  const issues: WorldValidationIssue[] = [];
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', '$', 'Expected a world snapshot object.');
    return issues;
  }

  validateSerializable(value, '$', issues, new Set<object>());
  rejectUnexpectedFields(value, snapshotKeys, '$', issues);
  requireFields(
    value,
    ['schemaVersion', 'scenarioId', 'revision', 'entities', 'relations'],
    '$',
    issues,
  );

  if (value.schemaVersion !== 2) {
    addIssue(issues, 'invalid-value', '$.schemaVersion', 'World schemaVersion must be 2.');
  }
  if (!isNonEmptyString(value.scenarioId)) {
    addIssue(issues, 'invalid-value', '$.scenarioId', 'Scenario ID must be non-empty.');
  }
  if (
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  ) {
    addIssue(issues, 'invalid-value', '$.revision', 'Revision must be a non-negative integer.');
  }

  const validEntities: Record<string, WorldEntity> = {};
  if (!isPlainRecord(value.entities)) {
    addIssue(issues, 'invalid-type', '$.entities', 'Entities must be an ID-keyed record.');
  } else {
    for (const entityId of Object.keys(value.entities).sort()) {
      const entity = validateEntity(
        value.entities[entityId],
        entityId,
        `$.entities[${JSON.stringify(entityId)}]`,
        issues,
      );
      if (entity !== undefined) {
        validEntities[entityId] = entity;
      }
    }
  }

  const validRelations: Record<string, WorldRelation> = {};
  if (!isPlainRecord(value.relations)) {
    addIssue(issues, 'invalid-type', '$.relations', 'Relations must be an ID-keyed record.');
  } else {
    for (const relationId of Object.keys(value.relations).sort()) {
      const relation = validateRelation(
        value.relations[relationId],
        relationId,
        `$.relations[${JSON.stringify(relationId)}]`,
        issues,
      );
      if (relation !== undefined) {
        validRelations[relationId] = relation;
      }
    }
  }

  validateCrossReferences(validEntities, validRelations, issues);
  return issues;
};

export const validateWorldSnapshot = (value: unknown): WorldSnapshot => {
  const issues = getWorldSnapshotValidationIssues(value);
  if (issues.length > 0) {
    throw new WorldValidationError(issues);
  }
  return value as WorldSnapshot;
};

export const assertValidWorldSnapshot = (value: unknown): asserts value is WorldSnapshot => {
  validateWorldSnapshot(value);
};

export const isWorldSnapshot = (value: unknown): value is WorldSnapshot =>
  getWorldSnapshotValidationIssues(value).length === 0;
