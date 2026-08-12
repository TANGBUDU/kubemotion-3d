# Beginner acceptance diagnostic

Failed gate after retry: **content-validation**

```text
===== whitespace =====
===== lint =====
$ eslint .

/home/runner/work/kubemotion-3d/kubemotion-3d/src/components/BeginnerProblemStage.tsx
  191:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

✖ 1 problem (0 errors, 1 warning)

===== typecheck =====
$ tsc -b --pretty false
===== content-validation =====
$ tsx scripts/validate-content.ts
/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:245
          throw new Error(
                ^

Error: Flow story readiness-failure-and-traffic-shift beat readiness-fails references missing route client-service-api-c on lesson step endpoint-becomes-not-ready
    at <anonymous> (/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:245:17)
    at Array.map (<anonymous>)
    at <anonymous> (/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:242:36)
    at Array.map (<anonymous>)
    at FlowStoryEngine.compileStory (/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:218:56)
    at <anonymous> (/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:287:51)
    at Array.map (<anonymous>)
    at FlowStoryEngine.compileStories (/home/runner/work/kubemotion-3d/kubemotion-3d/src/course/FlowStoryEngine.ts:287:31)
    at <anonymous> (/home/runner/work/kubemotion-3d/kubemotion-3d/scripts/validate-content.ts:189:45)
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)

Node.js v24.18.0
[ELIFECYCLE] Command failed with exit code 1.
```
