# Foundation-first rebuild progress

## Rebuild authority

- Directive: [`../../KUBEMOTION_FOUNDATION_FIRST_REBUILD_DIRECTIVE.md`](../../KUBEMOTION_FOUNDATION_FIRST_REBUILD_DIRECTIVE.md)
- Start prompt: [`../../CODEX_START_PROMPT.txt`](../../CODEX_START_PROMPT.txt)
- Rejected reference: [`before-after/current-overview.png`](./before-after/current-overview.png)
- Baseline branch commit: `bdcc5f92e61ff3e9bcee2c5048a0dbc87c19e0c4`
- Measured starting curriculum: 2 available / 20 planned

## Milestone ledger

| Milestone                             | Status      | Commit message                                                          | Evidence                                                                                       |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0 — Baseline and protection           | COMPLETE    | `docs: capture rejected visual baseline and rebuild gates`              | Current findings, repeatable baseline capture, rejected reference, visual and route checklists |
| 1 — Scene grammar and density         | NOT STARTED | `feat: add view-specific scene grammars and density budgets`            | —                                                                                              |
| 2 — Foundation and semantic islands   | NOT STARTED | `feat: rebuild the cluster from a clear foundation`                     | —                                                                                              |
| 3 — Runtime hierarchy models          | NOT STARTED | `feat: make node pod and container hierarchy explicit`                  | —                                                                                              |
| 4 — Logical object models             | NOT STARTED | `feat: establish distinct logical Kubernetes object visuals`            | —                                                                                              |
| 5 — Camera, labels, responsive layout | NOT STARTED | `feat: make teaching scenes readable across viewport sizes`             | —                                                                                              |
| 6 — Persistent route engine           | NOT STARTED | `feat: replace free-flying tokens with persistent semantic routes`      | —                                                                                              |
| 7 — Migrate existing authored lessons | NOT STARTED | `feat: migrate the original lessons to the foundation-first system`     | —                                                                                              |
| 8 — Twelve complete lessons           | NOT STARTED | `feat: expand the interactive foundations curriculum to twelve lessons` | —                                                                                              |
| 9 — Eight flow stories                | NOT STARTED | `feat: deliver readable control and application flow stories`           | —                                                                                              |
| 10 — Final gates and deployment       | NOT STARTED | `test: lock visual teaching and flow acceptance gates`                  | —                                                                                              |

## Milestone 0 checklist

- [x] Imported the complete directive and short start prompt at repository root.
- [x] Imported the supplied screenshot at repository root and as the rejected review reference.
- [x] Recorded the actual branch and `origin/main` commits.
- [x] Measured the actual available/planned lesson counts instead of adopting the directive's stale
      starting count.
- [x] Captured Explore and every actually available lesson at 1440×900.
- [x] Captured the first authored persistent-route step for each available lesson.
- [x] Recorded entity, relation, label, route, arrowhead, token, and resource diagnostics.
- [x] Recorded current route behavior and correct systems that must survive the rebuild.
- [x] Replaced the prior release checklist with the new foundation-first human gates.
- [x] Added a dedicated route acceptance checklist.
- [x] Run the complete baseline validation suite.
- [x] Commit Milestone 0 with the mandated message.

## Automated checks for the current milestone

| Check                     | Result                                              |
| ------------------------- | --------------------------------------------------- |
| `pnpm visual:baseline`    | PASS — Explore + 2 available lessons, 5 screenshots |
| `pnpm format:check`       | PASS                                                |
| `pnpm lint`               | PASS                                                |
| `pnpm typecheck`          | PASS                                                |
| `pnpm content:validate`   | PASS — 2 available, 20 planned                      |
| `pnpm content:accuracy`   | PASS — 194 public text files, 22 local links        |
| `pnpm test:unit -- --run` | PASS — 32 files, 229 tests                          |
| `pnpm build`              | PASS                                                |
| `pnpm test:e2e`           | PASS — 132 passed, 45 intentional skips, 0 failed   |

## Human screenshot status

Milestone 0 is a baseline-capture milestone. The rejected reference and current Explore capture are
expected to fail the new product gates; faithfully recording those failures is the M0 acceptance
condition. They are not approved future baselines.

- Foundation-first final gate: FAIL at baseline.
- Runtime hierarchy final gate: FAIL at baseline.
- Distinct-model final gate: FAIL at baseline.
- Label final gate: PARTIAL at baseline; overlap metrics pass, comprehension does not.
- Route final gate: PARTIAL at baseline; persistent `Line2` routes exist, full grammar/obstacle
  contracts do not.
- Teaching final gate: PASS for the two guided lessons, FAIL for default Explore composition.

## Next coherent task

Milestone 1 must make visibility a scene-grammar responsibility, create six independent grammar
definitions and explicit desktop/mobile density budgets, change Explore's default projection to the
Overview grammar, and replace the test that currently requires multiple views to share identical
geometry.
