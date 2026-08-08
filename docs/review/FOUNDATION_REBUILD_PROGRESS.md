# Foundation-first rebuild progress

## Rebuild authority

- Directive: [`../../KUBEMOTION_FOUNDATION_FIRST_REBUILD_DIRECTIVE.md`](../../KUBEMOTION_FOUNDATION_FIRST_REBUILD_DIRECTIVE.md)
- Start prompt: [`../../CODEX_START_PROMPT.txt`](../../CODEX_START_PROMPT.txt)
- Rejected reference: [`before-after/current-overview.png`](./before-after/current-overview.png)
- Baseline branch commit: `bdcc5f92e61ff3e9bcee2c5048a0dbc87c19e0c4`
- Measured starting curriculum: 2 available / 20 planned

## Milestone ledger

| Milestone                             | Status      | Commit message                                                          | Evidence                                                                                                            |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0 — Baseline and protection           | COMPLETE    | `docs: capture rejected visual baseline and rebuild gates`              | Current findings, repeatable baseline capture, rejected reference, visual and route checklists                      |
| 1 — Scene grammar and density         | COMPLETE    | `feat: add view-specific scene grammars and density budgets`            | Six grammar contracts, enforced projections, deterministic safety tests, six-view screenshots                       |
| 2 — Foundation and semantic islands   | COMPLETE    | `feat: rebuild the cluster from a clear foundation`                     | One bounded foundation, three non-overlapping semantic islands, dedicated Cluster/etcd visuals, desktop screenshots |
| 3 — Runtime hierarchy models          | COMPLETE    | `feat: make runtime containment visually self-evident`                  | One Node dimension source, four bays, embedded system modules, strict containment diagnostics, desktop screenshots  |
| 4 — Logical object models             | COMPLETE    | `feat: establish distinct logical Kubernetes object visuals`            | Namespace workspace, Deployment blueprint, dynamic EndpointSlice rows, external actors, six reviewed captures       |
| 5 — Camera, labels, responsive layout | COMPLETE    | `feat: make teaching scenes readable across viewport sizes`             | Responsive grammar runtime, safe viewport, two camera modes, unified mobile label budget, fifteen reviewed captures |
| 6 — Persistent route engine           | COMPLETE    | `feat: replace free-flying tokens with persistent semantic routes`      | Canonical anchors, persistent wide routes, sparse obstacle planning, 9-case / 36-screenshot browser acceptance      |
| 7 — Migrate existing authored lessons | COMPLETE    | `feat: migrate the original lessons to the foundation-first system`     | Five schema-v2 lessons, 10-objective / 45-screenshot multilingual browser acceptance                                |
| 8 — Twelve complete lessons           | NOT STARTED | `feat: expand the interactive foundations curriculum to twelve lessons` | —                                                                                                                   |
| 9 — Eight flow stories                | NOT STARTED | `feat: deliver readable control and application flow stories`           | —                                                                                                                   |
| 10 — Final gates and deployment       | NOT STARTED | `test: lock visual teaching and flow acceptance gates`                  | —                                                                                                                   |

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

## Milestone 2 checklist

- [x] Made `SceneStage` the single owner of one bounded cluster foundation.
- [x] Removed the dominant full-stage grid and retained only fourteen local alignment marks.
- [x] Made the layout/scene registry the sole owner of view-specific semantic islands, so the stage
      and the active layout no longer draw duplicate plates.
- [x] Replaced the Placement-derived Overview with a deterministic Overview layout.
- [x] Established three non-overlapping Overview landmarks: `CONTROL PLANE`, `WORKER NODES`, and
      `UNSCHEDULED / TRANSIT`.
- [x] Kept the pending tray visibly separate from every Node and preserved it even when empty.
- [x] Placed scheduled Pods into their Node bays and kept a Pending Pod in the unscheduled lane in
      layout tests.
- [x] Projected Control Flow onto its own three-island semantic composition rather than reusing the
      Overview composition.
- [x] Added a compact Cluster boundary plaque without introducing a second floor slab.
- [x] Added a dedicated etcd storage-cell visual and limited the basic conceptual relation to
      API Server → etcd.
- [x] Added deterministic layout, non-overlap, stage-bound, visual-factory, and foundation-ownership
      regression tests.
- [x] Raised Cluster and etcd label priority enough to preserve their role in the desktop Overview
      while staying inside the label budget.

## Milestone 2 automated checks

| Check                                    | Result                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm visual:m2`                         | PASS — four foundation review captures and a machine-readable manifest |
| Overview layout determinism              | PASS — repeated plans are identical                                    |
| Semantic-island overlap and stage bounds | PASS — three island families, zero pairwise overlap, all in bounds     |
| Scheduled/Pending placement              | PASS — scheduled Pods use Node bays; Pending stays in transit          |
| Foundation ownership diagnostics         | PASS — 3 foundation meshes, 14 local marks, 0 dominant-grid marks      |
| Dedicated Cluster and etcd visual tests  | PASS — no generic fallback or duplicate Cluster floor                  |
| `pnpm format:check` / `pnpm lint`        | PASS                                                                   |
| `pnpm typecheck` / `pnpm build`          | PASS                                                                   |
| `pnpm content:validate`                  | PASS — 2 available, 20 planned                                         |
| `pnpm content:accuracy`                  | PASS — current counts enforced by the release gate                     |
| `pnpm test:unit -- --run`                | PASS — 35 files, 244 tests                                             |
| `pnpm test:e2e`                          | PASS — 132 passed, 45 intentional skips, 0 failed                      |

## Milestone 2 screenshot review

Manifest: [`evidence/m2/m2-foundation-manifest.json`](./evidence/m2/m2-foundation-manifest.json)

| Capture                                                                                            | View         | Viewport | Foundation and island result                                                                                   | Five-second result               |
| -------------------------------------------------------------------------------------------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [`m2-overview-foundation-1440x900.png`](./evidence/m2/m2-overview-foundation-1440x900.png)         | Overview     | 1440×900 | PASS — bounded base and all three semantic landmarks are immediately separable                                 | PASS                             |
| [`m2-overview-foundation-1280x720.png`](./evidence/m2/m2-overview-foundation-1280x720.png)         | Overview     | 1280×720 | PASS — control plane, three worker chassis, and the transit tray remain statically readable                    | PASS                             |
| [`m2-control-flow-foundation-1280x720.png`](./evidence/m2/m2-control-flow-foundation-1280x720.png) | Control Flow | 1280×720 | PASS — API Server and etcd stay on the control-plane island; all three island families remain in bounds        | PASS for the M2 layout scope     |
| [`m2-overview-foundation-390x844.png`](./evidence/m2/m2-overview-foundation-390x844.png)           | Overview     | 390×844  | FAIL — the scene is present, but the current mobile panel and camera composition make it too small and crowded | FAIL — explicitly assigned to M5 |

Human M2 result: PASS for the desktop foundation milestone. At both desktop review widths, a new
learner can identify the cluster boundary, control-plane island, worker-node island, and
unscheduled/transit area within five seconds without reading a lesson paragraph. The empty transit
tray remains intentional evidence of where a Pending Pod belongs; it is not a fourth universal
object pile.

The 390×844 capture is deliberately recorded as a failure rather than silently accepted. Mobile
navigation/panel collapse, viewport-specific entity replanning, camera framing, and teaching-sheet
composition belong to M5. M2 does not claim mobile readability simply because the same world can be
rendered there.

## Milestone 3 checklist

- [x] Made `dimensions.node` the single geometry source for Node footprint, four bay anchors, Pod
      landing height, system-module strip, and kubelet/runtime mount offsets.
- [x] Rebuilt each Node as a load-bearing chassis with exactly four visible Pod bays and a separate
      system-module strip that cannot overlap scheduled Pods.
- [x] Embedded dedicated selectable `KubeletVisualHandle` and `ContainerRuntimeVisualHandle`
      models at different Node-local mounts; neither is represented as a generic placeholder when
      its entity is present.
- [x] Made every scheduled Pod occupy one deterministic bay and fail fast when a fifth Pod would
      overflow a four-bay Node instead of silently drawing an invalid extra row.
- [x] Kept Pending Pods parentless and outside every Node chassis.
- [x] Added a stable short Pod UID fingerprint, two deterministic Container slots inside the Pod
      shell, and a restart badge that appears only when the aggregate `restartCount` is positive.
- [x] Made a third Container fail before mutating the two-slot Pod composition.
- [x] Added strict layout diagnostics for Node-bay containment, duplicate assignments, Pod/Pod and
      Pod/system-module overlap, and Pending-Pod placement.
- [x] Added strict scene-hierarchy diagnostics for mounted kubelets, mounted runtimes, orphaned
      system modules, contained Containers, and Containers outside Pods.
- [x] Fixed nested layout transitions so Node- and Pod-composed children inherit parent motion
      instead of receiving a second world-space interpolation.
- [x] Captured and reviewed the runtime hierarchy at three desktop teaching states and at the
      390×844 mobile risk viewport.

## Milestone 3 automated checks

| Check                                        | Result                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm visual:m3`                             | PASS — three desktop acceptance captures, one recorded mobile-risk capture, and a diagnostics manifest                                |
| Node geometry single-source tests            | PASS — visual mounts, layout slots, and diagnostics all consume `dimensions.node`                                                     |
| Four-bay placement and overflow guards       | PASS — one Pod per bay; a fifth scheduled Pod fails before layout mutation                                                            |
| Pod/Container anatomy tests                  | PASS — UID fingerprint, two contained slots, conditional restart badge, and state shapes                                              |
| Runtime scene-composition tests              | PASS — kubelet/runtime mounts and Container containment survive sync, detach, removal, and disposal                                   |
| Strict runtime-layout diagnostics            | PASS — rendered THREE AABBs, not nominal Pod dimensions, report no outside-bay, duplicate, overlap, or Pending-inside-Node violations |
| Nested layout-transition regression          | PASS — composed children are excluded from duplicate world-space interpolation                                                        |
| `pnpm format:check` / `pnpm lint`            | PASS                                                                                                                                  |
| `pnpm typecheck` / `pnpm build`              | PASS                                                                                                                                  |
| `pnpm content:validate` / `content:accuracy` | PASS                                                                                                                                  |
| `pnpm test:unit -- --run` / `pnpm test:e2e`  | PASS                                                                                                                                  |

## Milestone 3 screenshot review

Manifest: [`evidence/m3/m3-runtime-hierarchy-manifest.json`](./evidence/m3/m3-runtime-hierarchy-manifest.json)

| Capture                                                                                      | View / state                           | Viewport | Runtime-hierarchy result                                                                                    | M3 result                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`m3-placement-runtime-1280x720.png`](./evidence/m3/m3-placement-runtime-1280x720.png)       | Placement & Runtime                    | 1280×720 | 3 Nodes / 12 bays / 3 Pods; all containment violations and label overlap/outside counts are zero            | PASS                            |
| [`m3-pod-container-close-1440x900.png`](./evidence/m3/m3-pod-container-close-1440x900.png)   | Selected Pod / Container close-up      | 1440×900 | Pod shell, UID fingerprint, and contained Container slot pass; restart count zero correctly leaves no badge | PASS                            |
| [`m3-pending-outside-node-1280x720.png`](./evidence/m3/m3-pending-outside-node-1280x720.png) | Replacement Pod still Pending, step 6  | 1280×720 | `pendingPods=1`, `pendingPodsInsideNodes=0`; every bay/overlap and label overlap/outside violation is zero  | PASS                            |
| [`m3-pod-container-390x844.png`](./evidence/m3/m3-pod-container-390x844.png)                 | Runtime hierarchy, mobile risk capture | 390×844  | Filter controls occupy the upper frame; the scene is pushed down and clipped despite valid containment      | RECORDED — M5 risk, not M3 PASS |

Human M3 result: PASS for desktop runtime containment. Without relying on detailed labels, the
review captures expose the chain `Node chassis → Pod bay → Pod shell → Container status slot`,
while the Node-local kubelet and Container runtime remain visibly separate from workload bays. The
manifest's strict diagnostics make an attractive but invalid placement fail the gate: scheduled
Pods must be inside unique bays, Pending Pods must be outside Nodes, system modules must not overlap
Pods, and Container handles must remain inside their Pod slots.

The 390×844 capture remains an explicit M5 risk. M3 proves geometry and containment at that
viewport; it does not claim that the current mobile panel, camera framing, label budget, or teaching
sheet makes the hierarchy comfortably readable.

## Milestone 4 checklist

- [x] Added the verified `shop` Namespace and `api` Deployment to the golden v2 world, with real
      scope and ownership relations and no invented traffic semantics.
- [x] Replaced Logical's former Placement inheritance with independent Namespace, Deployment,
      ReplicaSet, and Pod ownership columns; Node context is hidden by default and never acts as a
      logical parent.
- [x] Rendered Namespace as a shallow logical workspace and Deployment as an in-place-updating
      desired-state blueprint with strategy, version, revision, and replica intent.
- [x] Preserved the existing ReplicaSet SPEC / OBSERVED / READY card and Service stable-entry
      portal as distinct silhouettes.
- [x] Rebuilt EndpointSlice as a dynamic endpoint inventory with Ready, serving, terminating, and
      route-selected evidence; row growth preserves existing handles.
- [x] Kept application requests on Client → Service → Pod while using EndpointSlice only as
      selection/configuration evidence.
- [x] Added standalone Browser/ExternalClient and Developer terminal models with no Pod anatomy.
- [x] Moved kubectl outside the control-plane island so the verified external actor remains visible
      and enters the API Server from outside the cluster context.
- [x] Added registry, layout-separation, guided-scene, endpoint-selection, dynamic-row, label, and
      disposal regression coverage.

## Milestone 4 automated checks

| Check                                         | Result                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm visual:m4`                              | PASS — six captures, zero generic handles, label overlap, or labels outside the stage        |
| Logical/Placement separation                  | PASS — Logical has 1 Namespace / 1 Deployment / 1 ReplicaSet / 3 Pods / 0 Nodes              |
| Dedicated model and role-signature audit      | PASS — eight unique specialized models and eight unique role signatures                      |
| EndpointSlice growth and selected-route audit | PASS — 3→5 stable rows; one selected backend; EndpointSlice never becomes a request hop      |
| External actor placement                      | PASS — kubectl is outside the control-plane island and visibly separated from the API Server |
| `pnpm content:validate`                       | PASS — 2 v2 scenarios, 32 entities, 34 relations, 2 verified lessons, 20 planned             |
| `pnpm content:accuracy`                       | PASS — 227 current-public text files and all factual invariants                              |
| `pnpm test:unit -- --run`                     | PASS — 41 files, 274 tests                                                                   |
| `pnpm format:check` / `pnpm lint`             | PASS                                                                                         |
| `pnpm typecheck` / `pnpm build`               | PASS                                                                                         |

## Milestone 4 screenshot review

Manifest: [`evidence/m4/m4-logical-models-manifest.json`](./evidence/m4/m4-logical-models-manifest.json)

The 1440×900 and 1280×720 Logical captures make the Namespace workspace and the
Deployment → ReplicaSet → Pod chain readable without confusing it with Node placement. The
Placement capture contains Nodes and Pods but no Namespace, Deployment, or ReplicaSet. The traffic
capture retains the Service portal, EndpointSlice rows, persistent route, direction markers, and
selected Ready backend. The corrected Control Flow capture clearly places the kubectl terminal to
the left of—and outside—the control-plane island.

Human M4 result: PASS for desktop model identity, logical/physical separation, and the verified
external actor. The 390×844 capture remains evidence of the already-owned M5 responsive
composition problem; it does not weaken M4's model semantics.

## Milestone 5 checklist

- [x] Made CourseEngine and Explore compile the same authored world through the actual desktop or
      mobile grammar at runtime instead of shrinking a desktop projection.
- [x] Kept Guided lessons on the orthographic teaching camera and added a low-distortion
      perspective option plus deterministic reset controls to Explore only.
- [x] Connected safe viewport framing to measured overlay rectangles, including Explore tabs,
      camera controls, legend, caption, and any intersecting inspector surface.
- [x] Kept both camera frustums current across resize, selection, refocus, view changes, and
      projection toggles.
- [x] Wired cancelable orthographic camera transitions with deterministic finish behavior,
      disabled controls during transition, and instant settled poses for reduced motion.
- [x] Enforced the directive's label priority order: zone heading, focused entity, active route,
      selected secondary entity, then context.
- [x] Enforced one shared mobile budget of three across entity, layout, route, and teaching-callout
      labels, with a one-route-label sub-budget and deterministic tie breaking.
- [x] Made dimmed labels lower priority than every normal context label and made labels avoid
      teaching-callout rectangles.
- [x] Added EN, JA, and zh-CN safe-frame and label-budget regressions at 390 px and the exact 720 px
      breakpoint.
- [x] Replaced the permanent Explore sidebar with a compact top toolbar and added a compact scene
      legend without hiding the six view grammars.
- [x] Recompiled from the renderer host width (including the exact 720 px boundary) without
      replaying an already-settled authored step.
- [x] Kept the mobile inspector to a bounded bottom sheet and exposed a mobile reset whenever
      desktop-only filters remain active.
- [x] Made the mobile lesson scene occupy 49.4vh while keeping the Teaching sheet, “What changed,”
      Evidence, and timeline visible without horizontal overflow.
- [x] Kept the active `UNSCHEDULED / TRANSIT` heading in the three-label mobile budget whenever a
      Pending Pod is visible, and rejected clipped or completion-card-obscured “What changed” text.
- [x] Captured and machine-checked five objectives at 1440×900, 1280×720, and 390×844, rotating all
      three locales through every objective and viewport class.
- [x] Completed the human five-second review of all fifteen captures.

## Milestone 5 automated checks

| Check                                                               | Result                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm visual:m5`                                                    | PASS — 15/15 captures across five objectives, three viewports, and three locales                                                      |
| Runtime viewport projection                                         | PASS — desktop/mobile plans differ deterministically without mutating authored lessons                                                |
| Camera and safe viewport                                            | PASS — Guided orthographic, Explore orthographic/perspective/reset, measured exclusions, zero active camera transitions at settlement |
| Mobile total label budget                                           | PASS — exactly 3 visible entity/layout/route/callout labels in every 390×844 capture                                                  |
| Mobile composition                                                  | PASS — lesson scene 49.4vh, expanded Teaching sheet, fully visible/unobscured “What changed,” zero horizontal overflow                |
| Label and safe-frame geometry                                       | PASS — zero label/callout overlaps, zero labels outside stage or safe rectangle, minimum scene text 10 CSS px                         |
| Overview framing                                                    | PASS — teaching subjects fill 48–97% of the safe frame and the complete foundation stays inside the UI-free content rectangle         |
| Persistent-route evidence                                           | PASS — settled Service and restart captures retain wide lines, arrowheads, and numbered markers                                       |
| Runtime hierarchy                                                   | PASS — scheduled Pods remain in bays, Containers remain in Pods, Pending Pod remains outside Nodes                                    |
| `pnpm content:validate`                                             | PASS — 2 v2 scenarios, 32 entities, 34 relations, 2 verified lessons, 20 planned                                                      |
| `pnpm test:unit -- --run`                                           | PASS — 42 files, 292 tests                                                                                                            |
| `pnpm test:e2e`                                                     | PASS — 135 passed, 51 intentional skips, 0 failed                                                                                     |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS                                                                                                                                  |

## Milestone 5 screenshot review

Manifest: [`evidence/m5/m5-responsive-visual-manifest.json`](./evidence/m5/m5-responsive-visual-manifest.json)

Human acceptance: [`evidence/m5/M5_VISUAL_ACCEPTANCE.md`](./evidence/m5/M5_VISUAL_ACCEPTANCE.md)

Human M5 result: PASS. The mobile Overview uses a compact toolbar and a two-row six-view selector;
the focused Pod/Container capture fills the useful scene; the Service request remains statically
traceable; restart and Pending states retain the focused object beside an expanded explanation.
The historical M2/M3/M4 390×844 risk captures are superseded by this passing matrix without being
rewritten or deleted.

## Milestone 6 checklist

- [x] Replaced route-like free coordinates and entity-path cues with authored `activeRoutes` whose
      hops reference canonical semantic anchors only.
- [x] Defined one shared anchor contract: `api-in`, `api-out`, `control`, `network-in`,
      `network-out`, `storage`, `ownership`, `placement`, `local-runtime`, `top`, `bottom`, `left`,
      and `right`.
- [x] Added distinct ingress/egress anchors to the API Server, Service, Pod, Container, Node,
      external actors, etcd, Scheduler, kubelet, runtime, Controller Manager, and EndpointSlice
      visuals instead of silently routing through model centers.
- [x] Made `persistAfterAnimation: true` a schema-level invariant and made a missing renderer route
      fail instead of degrading to a free-flying token.
- [x] Kept primary routes visible before, during, and after motion as `Line2` wide lines with
      arrowheads and numbered hop markers; reduced motion retains the same static evidence with no
      moving tokens.
- [x] Added explicit request/response phase and direction validation, including a required pause
      between paired phases and a reversed physical path for a separately authored response route.
- [x] Kept EndpointSlice out of the packet path while requiring its Service identity, selected
      Ready/serving/non-terminating row, and final physical backend to agree.
- [x] Rejected packet paths through Deployment, ReplicaSet, Namespace, EndpointSlice, HTTPRoute,
      ConfigMap, or Secret.
- [x] Added an explicit obstacle map for rendered model and visible-label AABBs, including real
      containment ancestry so endpoint-owned children are not treated as unrelated blockers.
- [x] Replaced the dense all-pairs route graph with deterministic sparse rectilinear neighbors and
      a stable minimum heap, preserving obstacle clearance without stalling the render thread.
- [x] Replanned active geometry when semantic anchors move and re-sampled active tokens against the
      new route instead of allowing endpoint drift or detached animation.
- [x] Split active and pooled route resources in diagnostics and added hard gates for obstacle
      intersection, endpoint drift, route-replan failures, off-route tokens, sub-4-CSS-pixel lines,
      missing arrows, and clipped routes/arrows/markers.
- [x] Added a raw-content contract that rejects packet-like cues without a schema-v2 persistent
      route and rejects route coordinates, waypoints, and entity paths before schema parsing.
- [x] Captured Request A, Request B, and Scheduler binding at all three required viewports and
      rotated EN/JA/zh-CN through the nine-case matrix, with four temporal phases per case.

## Milestone 6 automated checks

| Check                                       | Result                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm visual:m6`                            | PASS — 9 cases / 36 screenshots, 3 stories, 3 viewports, 3 locales, and 4 phases per case                                              |
| Persistent route lifecycle                  | PASS — route/arrow/marker evidence exists before, during, after, and in reduced motion; settled/reduced active token count is 0        |
| Normal-motion sampling                      | PASS — at least 16 samples per case; moving tokens observed on every replay                                                            |
| Obstacle, drift, and replanning diagnostics | PASS — 0 intersections, 0 endpoint drift, 0 off-route tokens, and 0 route-replan failures                                              |
| Flow-token route distance                   | PASS — measured maximum `4.44e-16`, below the `0.02` browser gate                                                                      |
| Reduced motion                              | PASS — maximum active tokens 0 while persistent route, arrows, markers, selected endpoint evidence, and mobile `worker-c` label remain |
| Route widths and safe rectangle             | PASS — no sub-4-CSS-pixel active route, arrowless route, or clipped route/arrow/marker                                                 |
| `pnpm test:unit -- --run`                   | PASS — 43 files, 314 tests                                                                                                             |
| `pnpm test:e2e`                             | PASS — 136 passed, 53 intentional skips, 0 failed                                                                                      |

Manifest: [`evidence/m6/m6-route-visual-manifest.json`](./evidence/m6/m6-route-visual-manifest.json)

Human M6 result: PASS. The static screenshots remain traceable without animation, normal replay
adds moving tokens without replacing the route, and reduced motion removes those tokens without
removing the route or EndpointSlice selection evidence.

## Milestone 7 checklist

- [x] Migrated `cluster-overview`, `pod-and-placement`, and `manifest-to-running-pod` from the
      legacy authored format to schema v2.
- [x] Kept `service-routes-to-pods` and `container-restart-vs-pod-replacement` on the same v2
      foundation-first contracts, making all five original lessons genuinely available.
- [x] Reordered the public course as Cluster overview, Pod/Namespace/Node, manifest-to-running,
      Service/EndpointSlice, then restart-versus-replacement, with prerequisite-aware continuation.
- [x] Gave every normal step exactly one primary focus, localized What changed / Why / Takeaway,
      inspectable Evidence, glossary ordering, and official Kubernetes sources.
- [x] Kept logical ownership, physical placement, API/control communication, and application
      traffic in their independent scene grammars.
- [x] Made the manifest story an eight-step API-mediated flow from kubectl submission through
      persistence, reconciliation, scheduling, kubelet/runtime startup, and Ready state.
- [x] Kept all route-bearing steps on persistent semantic routes, including reduced motion; no
      packet path traverses Deployment, ReplicaSet, Namespace, or EndpointSlice.
- [x] Updated Home, completion, direct-navigation, cross-tab, memory-pressure, and all-complete
      behavior for the five-lesson manifest order.
- [x] Added a dedicated M7 browser matrix and manually reviewed representative desktop/mobile
      captures in English, Japanese, and Simplified Chinese.

## Milestone 7 automated checks

| Check                                     | Result                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm content:validate`                   | PASS — 2 v2 scenarios, 32 entities, 34 relations, 5 verified v2 lessons, 17 planned, 26 terms, 29 official sources |
| `pnpm visual:m7`                          | PASS — 10 objectives, 30 settled + 15 reduced-motion captures, 45 screenshots total                                |
| Grammar, focus, hierarchy, and route gate | PASS — all observable density/containment/route diagnostics are zero-failure                                       |
| Teaching and source gate                  | PASS — all representative steps expose localized teaching, Evidence, Takeaway, and verified official sources       |
| `pnpm test:unit -- --run`                 | PASS — 44 files, 318 tests                                                                                         |
| `pnpm test:e2e`                           | PASS — 136 passed, 53 intentional project/viewport skips, 0 failed                                                 |
| `pnpm format:check` / lint / type / build | PASS                                                                                                               |

Manifest: [`evidence/m7/m7-lesson-visual-manifest.json`](./evidence/m7/m7-lesson-visual-manifest.json)

Human M7 result: PASS. The five lessons now teach distinct facts through distinct projections:
the Overview starts from a bounded cluster foundation; Logical shows Namespace and ownership
without pretending Nodes are children; Placement makes Node → Pod → Container containment
structural; Control Flow keeps API and scheduling routes visible; Traffic keeps EndpointSlice as
selection evidence rather than a packet hop. The reviewed mobile captures retain both a useful 3D
scene and an expanded teaching sheet.

## Next coherent task

Milestone 8 must add the seven missing source-verified core lessons without double-counting the
five migrated lessons, reaching exactly 12 available interactive lessons and 10 planned lessons.
