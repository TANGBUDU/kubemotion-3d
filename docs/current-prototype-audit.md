# Current prototype audit

## Baseline identity and scope

- Audit date: 2026-08-07 (Asia/Shanghai).
- Repository: `TANGBUDU/kubemotion-3d`.
- Baseline commit: `c515f8a` (`feat: launch KubeMotion 3D learning platform`).
- Audit branch: `rebuild/world-state-engine`.
- Runtime used for validation: Node.js `v24.18.0`, pnpm `11.16.0`.
- Scope: read-only inspection of the current release plus deterministic screenshots. No production links or application source files were changed for this baseline.

The prototype is structurally healthy enough to build and deploy, but the core teaching model is not factually capable of representing lifecycle changes. The passing baseline tests therefore establish implementation stability only; they do not establish Kubernetes-semantic correctness.

## Golden-lesson baseline evidence

Screenshots were captured at a fixed `1440 x 1000` viewport with Chromium, after waiting for the canvas and 1.8 seconds for the current transition to settle.

| Current step               | Screenshot                                                                    | What the current release actually communicates                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `healthy-pod` (step 0)     | [`00-healthy-pod.png`](./audit/prototype-baseline/00-healthy-pod.png)         | `api-c` is already rendered on `worker-c` before any replacement event. `api-a` is a single capsule, with no inner Container, UID badge, restart counter, phase card, or ReplicaSet counts.                        |
| `container-crash` (step 1) | [`01-container-crash.png`](./audit/prototype-baseline/01-container-crash.png) | The entire `api-a` Pod capsule turns red. There is no independently rendered child Container, so the picture contradicts the narration that the Pod shell and identity remain while only its process fails.        |
| `replacement-pod` (step 4) | [`04-replacement-pod.png`](./audit/prototype-baseline/04-replacement-pod.png) | The old Pod is hidden and the already-existing `api-c` is focused on `worker-c`. No entity is created, no UID is shown or changed, no pending/unscheduled phase exists, and no ReplicaSet count drops or recovers. |

SHA-256 checksums:

```text
00-healthy-pod.png     3D8F7985931B0444DF74A8AE11A2342663E3A19E31D142DCCA4978F3D586E5B4
01-container-crash.png 466874B9EC93663559AD7DD780FC61172E69D5C8FC0B9A8C4C94628A976FD3C1
04-replacement-pod.png 878D0A1858DE4358D39F2444C7FCBC282C4883D82E952661CE9B0D86FD9BE912
```

## Verified defects

### Course and domain model

- **No factual world timeline.** `src/course/types.ts` defines only `SceneProjection`, `SceneProjectionPatch`, and arrays of projections/transitions. There is no per-step `WorldSnapshot`, typed world mutation, transaction, or `WorldDiff`.
- **One immutable graph is used for every step.** `src/course/CourseEngine.ts` compiles every projection against the same `ClusterGraph`; direct navigation retrieves a stored view projection, not a factual world snapshot.
- **View state fakes domain state.** `statusOverride` is part of the projection schema and renderer contract. The crash step uses `statusOverride: failed` on the Pod itself (`container-restart-vs-pod-replacement.yaml:107`).
- **Replacement is a pre-existing object.** `api-c` is declared in `demo-shop` before the lesson, is already owned by `api-rs`, scheduled on `worker-c`, and selected by the Service (`demo-shop.yaml:542-544`, `571-573`, `599-601`). The replacement step only focuses that ID (`container-restart-vs-pod-replacement.yaml:235`).
- **The base projection exposes the replacement early.** Its label selector makes every `app.kubernetes.io/name=api` entity visible, including `api-c`; the step-0 screenshot proves this is not merely dormant graph data.
- **No independent runtime Container exists in the lesson.** Consequently no operation can change only Container status, `restartCount`, or `instanceGeneration` while retaining Pod identity.
- **EndpointSlice membership is absent.** The scenario relates each EndpointSlice only to its Service (`contains-endpoint-for`) and describes it as tracking ready backends. It does not model endpoint members, conditions, addresses, or `targetRef`.
- **Selector relationships are static.** Service-to-Pod `selects` relations are fixed scenario edges; label/readiness changes cannot derive new membership.
- **Rich facts are narration-only.** UID and restart count appear in lesson prose, but not in the renderer input. ReplicaSet desired/current/ready counts and endpoint conditions are not rendered facts.

### Renderer and resources

- **One generic mesh per entity.** `SceneObjectFactory.create()` constructs one catalog mesh plus a selection ring. A Pod is not a shell containing Container child visuals; ReplicaSet, Node, kubelet, controller, and scheduler are generic archetype geometry.
- **No fact displays.** There are no visible UID, restart count, replica counter, endpoint-member, or comparison components.
- **Relations are rebuilt wholesale.** `SceneController.updateRelations()` removes the group and recreates every visible relation for each projection.
- **Relation material leak.** New `THREE.LineDashedMaterial` instances are allocated per relation per projection, but the removal traversal disposes only line geometry, not those materials.
- **Selection-ring ownership is incomplete.** Each entity allocates its own `TorusGeometry` and `MeshBasicMaterial`; `SceneRegistry.remove()` only detaches the group and does not dispose either resource.
- **Relation semantics are mostly flattened.** Every relation is the same dashed line form; only a small color switch is applied. Direction, arrowheads, route shape, relation emphasis, and labels are not rendered.
- **Declared callouts are not rendered.** `SceneCallout` exists in course types, but `SceneController` has no callout manager or projection callout rendering path.
- **`labelMode` is ignored.** `LabelManager` creates a label for every registry handle and always uses the localized title; it receives no projection label mode and has no collision, density, or occlusion policy.
- **Raycasting is not explicitly scoped.** It intersects every registry mesh. Hidden/removed/active-world/selectable filtering is not encoded in the selection contract.

### Layout

- **Array index drives placement.** All layout modes use the sorted entity index as a primary coordinate input.
- **Worker names are hardcoded.** Placement explicitly indexes `['worker-a', 'worker-b', 'worker-c']` in `src/renderer/LayoutEngine.ts`.
- **Nodes are not spatial containers.** They render as platforms, but there is no rack boundary, stable slot allocation, or parent/child placement contract.
- **Namespaces are not logical planes/groups**, and control/traffic layouts are not route-aware.
- **The picture does not encode Kubernetes semantics robustly.** Generic global coordinates, rather than world relations and typed entity data, determine most placement.

### Animation and playback

- **Only token paths animate over time.** `data-packet`, `dns-query`, and `api-request` move pooled spheres along paths.
- **Every non-path cue collapses to a scale mutation.** `AnimationCoordinator.ts:31` applies `root.scale.multiplyScalar(1.08)` for any cue with an entity ID. Camera focus, reconciliation, lifecycle, status, relation reveal, and callout do not have dedicated handlers.
- **Replay accumulates drift.** Repeated non-path playback permanently multiplies scale because cancellation does not restore a captured baseline.
- **Cancellation is incomplete.** It releases active path tokens but cannot restore transforms/materials changed by non-path cues.
- **Replay depends on reference identity.** `LearnPage` increments otherwise-unused React state; each render creates a fresh transition array, and `SceneViewport` replays from the changed array reference rather than an explicit playback command ID.

### Tests

- **Current unit tests establish determinism and schema/graph basics, not factual lesson history.** There are no assertions for old/new Pod existence, UID change, unchanged Node during restart, exact restart count, ReplicaSet counts, or EndpointSlice membership.
- **No patch or diff tests exist** because there is no world patch/diff engine.
- **No cue lifecycle tests exist** for start/update/finish/cancel/reset or reduced motion.
- **The leak smoke test is not a renderer-memory test.** It checks animation idle state and upper bounds for entity/label counts (`tests/e2e/leak-smoke.spec.ts:12`), but does not inspect geometries, textures, programs, materials, callouts, or repeated full-lesson cycles.
- **No visual regression baselines existed before this audit.** The current E2E suite checks navigation, language, Explore selection, and count-based smoke behavior, not whether the lesson picture communicates the stated facts.
- **No mobile golden-lesson acceptance flow exists.**

### Product and release presentation

- **README media is a placeholder** (`README.md:7`) rather than a verified screenshot/GIF.
- **The personal server is the canonical README link**, even though GitHub Pages is available.
- **The release overclaims completeness.** README and About state that five lessons are complete even though the golden lesson cannot represent its core facts.
- **The scene is squeezed by permanent panels.** Desktop uses a rigid `270px / minmax(400px, 1fr) / 350px` grid. At the audit viewport the canvas column is about 57% of total width, below the requested dominant-scene target.
- **Mobile removes course navigation without replacement.** The course rail is set to `display: none` below 720px; there is no mobile lesson/step selector.
- **Explore destroys context.** Nonmatching entities are hidden and relations remain only when both endpoints match, rather than keeping owners, Nodes, Services, and one-hop context dimmed.

## Baseline validation results

All commands were run against the unmodified `c515f8a` working tree before the audit files were added.

| Command                   | Result            | Relevant output                                                                                                                                     |
| ------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`       | PASS              | `All matched files use Prettier code style!`                                                                                                        |
| `pnpm lint`               | PASS              | Exit code 0; no diagnostics.                                                                                                                        |
| `pnpm typecheck`          | PASS              | Exit code 0; no diagnostics.                                                                                                                        |
| `pnpm content:validate`   | PASS              | 34 entities, 28 relations, 5 lessons, 26 terms, 25 sources.                                                                                         |
| `pnpm test:unit -- --run` | PASS              | 5 test files, 14 tests passed in 2.66s.                                                                                                             |
| `pnpm build`              | PASS with warning | Production build completed; Vite warned that `clusterGraph-B2hMLRzZ.js` is 563.99 kB minified (142.18 kB gzip), above the 500 kB warning threshold. |
| `pnpm test:e2e`           | PASS              | 5 Chromium tests passed in 6.8s.                                                                                                                    |

The test pass is not evidence that the lesson is correct: none of the existing assertions distinguishes a same-Pod Container restart from creation of a new Pod identity.

## Screenshot capture commands

The production build was served locally with `pnpm preview --host 127.0.0.1`. Each image was then captured using Playwright Chromium:

```text
pnpm exec playwright screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector canvas --wait-for-timeout 1800 --full-page http://127.0.0.1:4173/#/learn/container-restart-vs-pod-replacement/0 docs/audit/prototype-baseline/00-healthy-pod.png
pnpm exec playwright screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector canvas --wait-for-timeout 1800 --full-page http://127.0.0.1:4173/#/learn/container-restart-vs-pod-replacement/1 docs/audit/prototype-baseline/01-container-crash.png
pnpm exec playwright screenshot --browser chromium --viewport-size 1440,1000 --wait-for-selector canvas --wait-for-timeout 1800 --full-page http://127.0.0.1:4173/#/learn/container-restart-vs-pod-replacement/4 docs/audit/prototype-baseline/04-replacement-pod.png
```

The temporary preview server was stopped after capture. These assets are audit evidence only and are not release screenshots.
