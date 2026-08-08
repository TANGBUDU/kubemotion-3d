const ROUTE_DRIVEN_CUE_TYPES = new Set([
  'api-request',
  'data-packet',
  'dns-query',
  'reconcile-pulse',
  'scheduler-assignment',
  'node-runtime-restart',
]);

const FORBIDDEN_ROUTE_FIELDS = new Set([
  'path',
  'points',
  'positions',
  'entityPath',
  'coordinates',
  'waypoints',
  'controlPoints',
  'fromPosition',
  'toPosition',
]);

export interface RawRouteContractIssue {
  readonly path: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$-]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

function isNumericCoordinateTuple(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    (value.length === 2 || value.length === 3) &&
    value.every((part) => typeof part === 'number' && Number.isFinite(part))
  );
}

function isCoordinateRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasX = typeof value.x === 'number' && Number.isFinite(value.x);
  const hasY = typeof value.y === 'number' && Number.isFinite(value.y);
  const hasZ = typeof value.z === 'number' && Number.isFinite(value.z);
  return (hasX && hasY) || (hasX && hasZ) || (hasY && hasZ);
}

function inspectRouteCue(
  cue: Record<string, unknown>,
  cuePath: string,
  issues: RawRouteContractIssue[],
): void {
  const visited = new WeakSet<object>();

  const visit = (value: unknown, path: string): void => {
    if (isNumericCoordinateTuple(value) || isCoordinateRecord(value)) {
      issues.push({
        path,
        message: 'route-driven cues cannot contain free-floating coordinates',
      });
    }

    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) visit(item, `${path}[${index}]`);
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      const pathForKey = childPath(path, key);
      if (FORBIDDEN_ROUTE_FIELDS.has(key)) {
        issues.push({
          path: pathForKey,
          message: `route-driven cues cannot define ${key}; use an active semantic route`,
        });
      }
      visit(item, pathForKey);
    }
  };

  visit(cue, cuePath);
}

export function findRawLessonRouteContractIssues(
  document: unknown,
  sourcePath = 'lesson',
): readonly RawRouteContractIssue[] {
  const schemaVersion = isRecord(document) ? document.schemaVersion : undefined;
  const issues: RawRouteContractIssue[] = [];
  const visited = new WeakSet<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) visit(item, `${path}[${index}]`);
      return;
    }

    if (!isRecord(value)) return;
    if (typeof value.type === 'string' && ROUTE_DRIVEN_CUE_TYPES.has(value.type)) {
      if (schemaVersion !== 2) {
        issues.push({
          path,
          message: `${value.type} is route-driven and is forbidden in schemaVersion ${String(schemaVersion)} lessons`,
        });
      }
      inspectRouteCue(value, path, issues);
    }

    for (const [key, item] of Object.entries(value)) visit(item, childPath(path, key));
  };

  visit(document, sourcePath);
  return issues;
}

export function assertRawLessonRouteContract(document: unknown, sourcePath = 'lesson'): void {
  const issues = findRawLessonRouteContractIssues(document, sourcePath);
  if (issues.length === 0) return;
  throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}
