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
| 1 — Scene grammar and density         | COMPLETE    | `feat: add view-specific scene grammars and density budgets`            | Six grammar contracts, enforced projections, deterministic safety tests, six-view screenshots  |
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

## Milestone 1 checklist

- [x] Added independent Overview, Logical Ownership, Placement & Runtime, Control Flow, Traffic,
      and Storage grammar contracts.
- [x] Defined explicit allowed/default-hidden kinds, semantic zones, layout and camera policies,
      route rules, aggregation intent, separation values, and desktop/mobile budgets per grammar.
- [x] Added deterministic total and per-kind density pruning with explicit hidden reasons.
- [x] Made unfiltered Explore use the Overview grammar instead of focus-all/full-label state.
- [x] Kept explicit Explore filters as bounded detail-on-demand without weakening guided lessons.
- [x] Made guided compilation start hidden and pass the final authored view through the grammar.
- [x] Protected active-route and callout context and enforced relation endpoint visibility.
- [x] Enforced Container → Pod closure and scheduled Pod → Node closure only in physical views.
- [x] Replaced the exit-animation all-visible fallback with a grammar-safe before-world projection.
- [x] Added the missing Storage view tab and updated keyboard navigation gates.
- [x] Replaced the test that treated Placement geometry as the cross-view contract.
- [x] Added deterministic grammar and all-available-guided-step safety tests.
- [x] Captured and inspected all six Explore views at 1440×900.
- [x] Commit Milestone 1 with the mandated message.

## Milestone 1 automated checks

| Check                     | Result                                              |
| ------------------------- | --------------------------------------------------- |
| `pnpm visual:m1`          | PASS — 6 grammar views captured and density-checked |
| `pnpm format:check`       | PASS                                                |
| `pnpm lint`               | PASS                                                |
| `pnpm typecheck`          | PASS                                                |
| `pnpm content:validate`   | PASS — 2 available, 20 planned                      |
| `pnpm content:accuracy`   | PASS — current count recorded by the release gate   |
| `pnpm test:unit -- --run` | PASS — 34 files, 238 tests                          |
| `pnpm build`              | PASS                                                |
| `pnpm test:e2e`           | PASS — 132 passed, 45 intentional skips, 0 failed   |

## Milestone 1 screenshot review

Manifest: [`before-after/m1-scene-grammar-manifest.json`](./before-after/m1-scene-grammar-manifest.json)

| View         | Entities | Relations | Entity labels | Maximum label overlap | Labels outside stage | M1 result                                                        |
| ------------ | -------: | --------: | ------------: | --------------------: | -------------------: | ---------------------------------------------------------------- |
| Overview     |        9 |         6 |             6 |                     0 |                    0 | PASS — no longer the 17-entity universal scene                   |
| Logical      |        4 |         3 |             4 |                     0 |                    0 | PASS — ownership subset only                                     |
| Placement    |       12 |         6 |             3 |                     0 |                    0 | PASS — runtime subset within its budget                          |
| Control Flow |       12 |         9 |             4 |                     0 |                    0 | PASS — bounded context; relation-family cap is two               |
| Traffic      |        3 |         0 |             3 |                     0 |                    0 | PASS for filtering; source-world gap tracked for M2/M4           |
| Storage      |        2 |         1 |             2 |                     0 |                    0 | PASS for filtering; storage chain remains future curriculum work |

Human M1 result: PASS. The screenshots prove that view changes now change the visible teaching
subset and remain within density/label gates. They also show three deliberate non-M1 failures that
must not be mistaken for final acceptance:

- the layouts still use the old Placement-derived stage geometry;
- the Explore source world lacks Cluster, etcd, Service, and storage-chain objects;
- viewport-driven mobile entity replanning is not wired into the renderer yet.

Those are owned by the Foundation, model, responsive-layout, and course-migration milestones. The
M2 five-second Overview gate therefore remains FAIL until the foundation and semantic islands are
rebuilt.

## Next coherent task

Milestone 2 must make `SceneStage` the single owner of the bounded cluster foundation and semantic
islands, remove the Placement-derived layout fallback from Overview, and produce an Overview that
passes the five-second foundation gate without relying on empty universal lanes.
