# M8 curriculum acceptance checklist

Milestone 8 is accepted only when all 12 published lessons are usable as a coherent curriculum,
not merely listed as `available`. The browser gate covers every lesson, prioritizes the seven new
lessons, and gives the DNS, scheduling, readiness-traffic, and liveness-restart routes an explicit
reduced-motion replay.

## Run contract

- [x] A current production build is served at `KUBEMOTION_BASE_URL` (default
      `http://127.0.0.1:4173`).
- [x] `course.yaml` exposes exactly the expected 12 `available` schema-v2 lessons.
- [x] Content validation, typecheck, unit tests, and the relevant route tests pass before visual
      capture.
- [x] Run `pnpm visual:m8` from the repository root.
- [x] Do not accept a partial evidence directory after a failed run. Fix the failure and rerun the
      full matrix.

The script creates `docs/review/evidence/m8/`, writes all PNGs there, and emits
`m8-curriculum-visual-manifest.json`.

## Coverage matrix

| Lesson                               | Representative step           | Grammar      | Acceptance purpose                                                       | Reduced motion |
| ------------------------------------ | ----------------------------- | ------------ | ------------------------------------------------------------------------ | -------------- |
| Why Kubernetes exists                | `image-packages-the-app`      | Placement    | Image packaging is visibly separated from orchestration responsibility   | No             |
| Cluster overview                     | `cluster-summary`             | Overview     | Foundation, control-plane island, and worker area remain distinct        | No             |
| Pod and Container                    | `two-containers-one-pod`      | Placement    | Two Containers are visibly contained by one Pod                          | No             |
| Namespace and Node                   | `node-runtime-chassis`        | Placement    | Node bay, Pod, Container, kubelet, and runtime hierarchy is readable     | No             |
| Deployment, ReplicaSet and Pods      | `replicaset-owns-pod-slots`   | Logical      | Ownership and replaceable Pod slots are not physical placement           | No             |
| Manifest to Running Pod              | `pod-becomes-ready`           | Placement    | The submitted workload converges to a scheduled, running Pod             | No             |
| Pending Pod and scheduling           | `bind-pod-to-worker-c`        | Control Flow | Scheduler/API binding route ends at the selected Node                    | Yes            |
| Container restart vs Pod replacement | `compare-identities`          | Control Flow | Pod identity and Container runtime identity remain distinguishable       | No             |
| Labels and selectors                 | `one-pod-no-longer-matches`   | Logical      | A label change changes selector membership                               | No             |
| Service and EndpointSlice            | `endpoint-slice-backends`     | Traffic      | EndpointSlice is backend evidence, not a packet hop                      | No             |
| Internal request and DNS             | `dns-query-and-response`      | Traffic      | DNS request and response use client Pod → kube-dns Service → CoreDNS Pod | Yes            |
| Probes and rolling update            | `readiness-adds-v2-endpoint`  | Traffic      | A later request selects the newly Ready v2 endpoint                      | Yes            |
| Probes and rolling update            | `liveness-restarts-container` | Placement    | kubelet restarts the Container slot without replacing the Pod            | Yes            |

Every row is captured in these three viewport/locale combinations:

- 1440×900 with the row's first locale;
- 1280×720 or 1280×800 with its second locale;
- 390×844 with its third locale.

Locale order rotates per row so each objective has EN, JA, and zh-CN evidence. The four route rows
marked “Yes” receive a second screenshot in a `prefers-reduced-motion: reduce` context at all three
viewport/locale combinations.

Expected evidence volume:

- 39 settled PNGs: 13 objectives × 3 viewport/locale cases;
- 12 reduced-motion PNGs: 4 route objectives × 3 viewport/locale cases;
- 51 PNGs total;
- one zero-failure JSON manifest.

## Automated preflight gates

- [x] The available lesson set exactly matches the 12 expected lesson IDs.
- [x] Every lesson and scenario parses as schema v2 and compiles for desktop and mobile.
- [x] Every compiled step, not only the representative steps, resolves to exactly one focused
      entity.
- [x] Every step has factual Evidence plus non-empty localized What changed, Why, and Takeaway in
      EN, JA, and zh-CN.
- [x] Every representative stable step ID still exists and compiles to its required scene grammar.
- [x] Each reduced-motion objective names an existing persistent route with the expected semantic.
- [x] Each required route is numbered so its static marker remains visible.
- [x] No active route in any of the 12 lessons includes an EndpointSlice entity in a `from` or `to`
      hop. EndpointSlice may appear only as configuration, selection support, or Evidence.
- [x] The resolved matrix contains at least 36 settled and 12 reduced-motion cases.

## Browser geometry and hierarchy gates

- [x] Scene captures show the representative grammar badge and use an orthographic guided camera;
      the comparison capture retains the correct Control Flow grammar metadata and shows its
      visible `WORLD HISTORY` badge.
- [x] Exactly one focused entity label exists and is visible in every scene PNG; comparison steps
      retain the same one-focus compile contract without mounting a scene viewport.
- [x] Entity and route labels remain within the shared desktop/mobile density ceilings.
- [x] No label overlaps another label, leaves the scene host, leaves the camera safe rectangle, or
      carries the wrong language.
- [x] Focused entities and total scene bounds stay inside their safe content rectangles.
- [x] Neither the document nor the application root has horizontal overflow.
- [x] Scheduled Pods occupy unique Node bays whenever a Node chassis is visible.
- [x] Pending Pods remain outside Nodes; Pods do not overlap one another or Node system modules.
- [x] Containers remain inside Pod shells; mounted kubelet/runtime modules are not orphaned.
- [x] Each scene objective meets explicit viewport-aware hierarchy and relation minimums. Desktop
      retains the full authored density; the Deployment and Labels mobile captures deliberately
      retain two Pods, while Deployment retains two ownership relations.

## Teaching and evidence gates

- [x] The localized step-heading text exists in every capture and is visible on desktop. On mobile,
      the heading may be visually hidden by the compact layout only while the teaching sheet is
      expanded and What changed, Why, Takeaway, and Evidence remain visible.
- [x] What changed, Why, and Takeaway each have a visible, non-empty localized heading and body.
- [x] Evidence is visible and contains at least one factual row; an empty-state message never
      passes.
- [x] The mobile teaching sheet is expanded in the captured state.
- [x] The Sources badge and drawer agree on a non-zero count.
- [x] Every source has a title, authority, official Kubernetes URL, safe external-link attributes,
      and a visible verification date.
- [x] The `compare-identities` capture shows exactly two labelled comparison cards, each with all
      six compiled identity rows and non-empty values matching the localized comparison model.
- [x] The comparison panel stays within the lesson stage, has no horizontal overflow, is labelled
      by its visible heading, and mounts no hidden WebGL scene viewport.

## Persistent route and reduced-motion gates

- [x] Each route capture retains a wide-line route, arrowhead, numbered marker, and short route
      label after animation settles.
- [x] The accessible scene summary describes the ordered route hops.
- [x] Route, arrows, markers, and endpoints remain inside the safe rectangle.
- [x] Route-obstacle intersections, endpoint drift, replanning failures, arrowless routes,
      sub-4-CSS-pixel routes, and off-route tokens are all zero.
- [x] Wide-line geometry and material counts equal the active route-handle count.
- [x] Reduced-motion replay samples the complete transition window while leasing exactly zero flow
      tokens.
- [x] Reduced motion retains the persistent route, arrowheads, numbered markers, Evidence, and all
      teaching explanations.
- [x] Maximum sampled token-to-route distance is at most `0.02`.
- [x] DNS and application traffic remain distinct route semantics; the DNS route does not silently
      become an application Service route.
- [x] Ready-v2 traffic ends at the selected Ready v2 Pod, while EndpointSlice remains route support
      only.
- [x] The liveness route ends at the Container slot and does not imply Pod replacement.
- [x] The scheduling route makes the selected Node unambiguous and does not imply that binding
      itself starts the Container.

## Human PNG review

Review every PNG at 100% scale. Record the filename and observable defect for every FAIL.

- [x] The intended teaching fact is identifiable within five seconds without relying on narration.
- [x] The six scene grammars remain semantically different; they are not one universal object set
      rearranged under different badges.
- [x] Control-plane components, workload controllers, Pods, Containers, Services, EndpointSlices,
      and external actors retain distinct silhouettes.
- [x] Logical ownership, physical placement, control communication, DNS resolution, and application
      traffic are never visually conflated.
- [x] Node → Pod → Container containment is readable from the models themselves.
- [x] The unique focused object agrees with the teaching panel and Evidence.
- [x] A paused route is traceable from source to destination using its arrows and numbered markers.
- [x] DNS request and response are understandable as one DNS exchange; the later application
      request remains a separate route.
- [x] EndpointSlice is never drawn as a request hop.
- [x] Ready-v2 selection, liveness restart, and pending scheduling each communicate the correct
      lifecycle boundary.
- [x] Labels, panels, routes, arrows, and markers are neither clipped nor visually crowded.
- [x] Mobile preserves both a useful scene and a readable expanded teaching sheet.
- [x] EN, JA, and zh-CN communicate the same fact without untranslated placeholders or broken
      wrapping.
- [x] What changed, Why, Evidence, Takeaway, and the rendered world state agree.

## Acceptance record

- Result: PASS.
- Manifest: `docs/review/evidence/m8/m8-curriculum-visual-manifest.json` (`status: pass`, zero
  failures).
- Reviewed: all 51 PNGs at their authored resolution (39 settled and 12 reduced-motion).
- First-run correction: mobile labels are remeasured after a temporary `0×0` host, and the M8 gate
  now inspects comparison presentations independently from scene presentations.

Any automated or human FAIL blocks M8. The final acceptance record must name the zero-failure
manifest, confirm all 51 PNGs were reviewed, and link any corrective commit required by the first
run.
