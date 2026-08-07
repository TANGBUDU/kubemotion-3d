import { describe, expect, it } from 'vitest';
import { lessonById, scenario } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { createClusterGraph } from '../../src/domain/clusterGraph';

const graph = createClusterGraph(scenario);

describe('CourseEngine', () => {
  it('compiles deterministic projections', () => {
    const lesson = lessonById.get('manifest-to-running-pod');
    expect(lesson).toBeDefined();
    if (!lesson) return;
    expect(courseEngine.compileLesson(lesson, graph)).toEqual(
      courseEngine.compileLesson(lesson, graph),
    );
  });

  it('makes direct jump equal sequential compilation', () => {
    const lesson = lessonById.get('service-and-endpoints');
    expect(lesson).toBeDefined();
    if (!lesson) return;
    const compiled = courseEngine.compileLesson(lesson, graph);
    const direct = courseEngine.getProjection(compiled, 3);
    expect(direct).toEqual(compiled.projections[3]);
    expect(courseEngine.getProjection(compiled, 0)).toEqual(compiled.projections[0]);
  });

  it('keeps traffic paths away from Deployment objects', () => {
    const lesson = lessonById.get('service-and-endpoints');
    expect(lesson).toBeDefined();
    if (!lesson) return;
    const compiled = courseEngine.compileLesson(lesson, graph);
    const dataCues = compiled.transitions.flat().filter((cue) => cue.type === 'data-packet');
    expect(dataCues).toHaveLength(1);
    for (const cue of dataCues)
      if ('path' in cue) {
        expect(cue.path.map((id) => graph.entityById.get(id)?.kind)).not.toContain('Deployment');
      }
  });
});
