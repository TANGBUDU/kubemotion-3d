/// <reference types="node" />

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  assertRawLessonRouteContract,
  findRawLessonRouteContractIssues,
} from '../../src/content/rawRouteContract';

describe('raw lesson route contract', () => {
  it('rejects a V1 api-request even when it carries an entity path', () => {
    const issues = findRawLessonRouteContractIssues({
      schemaVersion: 1,
      steps: [
        {
          transition: [
            {
              type: 'api-request',
              path: ['developer', 'api-server'],
            },
          ],
        },
      ],
    });

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('forbidden in schemaVersion 1'),
        expect.stringContaining('cannot define path'),
      ]),
    );
  });

  it('rejects a route-less V1 reconcile cue', () => {
    expect(() =>
      assertRawLessonRouteContract({
        schemaVersion: 1,
        steps: [{ transition: [{ type: 'reconcile-pulse', entityId: 'controller' }] }],
      }),
    ).toThrow(/reconcile-pulse is route-driven/);
  });

  it.each([
    ['path', ['client', 'service']],
    [
      'points',
      [
        [0, 0, 0],
        [1, 0, 1],
      ],
    ],
    ['positions', [{ x: 0, y: 1, z: 2 }]],
    ['entityPath', ['client', 'service']],
  ])('rejects the forbidden %s field in V2 cues', (field, value) => {
    const issues = findRawLessonRouteContractIssues({
      schemaVersion: 2,
      steps: [
        {
          transition: {
            cues: [{ type: 'data-packet', routeId: 'route:request', [field]: value }],
          },
        },
      ],
    });

    expect(issues.some((issue) => issue.path.endsWith(`.${field}`))).toBe(true);
  });

  it('rejects unlabelled coordinate tuples and coordinate records', () => {
    const issues = findRawLessonRouteContractIssues({
      schemaVersion: 2,
      steps: [
        {
          transition: {
            cues: [
              {
                type: 'dns-query',
                routeId: 'route:dns',
                customStart: [1, 2, 3],
                customEnd: { x: 4, y: 5, z: 6 },
              },
            ],
          },
        },
      ],
    });

    expect(
      issues.filter((issue) => issue.message.includes('free-floating coordinates')),
    ).toHaveLength(2);
  });

  it('accepts every raw lesson in the repository', () => {
    const lessonDirectory = resolve(
      import.meta.dirname,
      '../../content/courses/kubernetes-foundations/lessons',
    );
    const files = readdirSync(lessonDirectory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
      .map((entry) => resolve(entry.parentPath, entry.name))
      .sort();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = parse(readFileSync(file, 'utf8'), { merge: true });
      expect(findRawLessonRouteContractIssues(raw, file), file).toEqual([]);
    }
  });
});
