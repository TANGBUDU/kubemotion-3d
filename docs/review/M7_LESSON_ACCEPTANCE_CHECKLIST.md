# M7 migrated-lesson acceptance checklist

Milestone 7 is accepted only when the original five lessons are schema-v2, marked `available`, and
readable through the same foundation-first grammar, visual-model, teaching-panel, and persistent
route contracts already proved in M1–M6. A lesson title in the catalog is not evidence of a
migration.

## Preconditions

- [x] `cluster-overview`, `pod-and-placement`, `manifest-to-running-pod`,
      `service-routes-to-pods`, and `container-restart-vs-pod-replacement` are all
      `schemaVersion: 2`.
- [x] The five matching entries in `course.yaml` are `status: available`.
- [x] Every representative `stepId` in the matrix below still exists. Step IDs are the stable
      acceptance contract; numeric indices are resolved from YAML when the capture starts.
- [x] `pnpm content:validate`, `pnpm content:accuracy`, unit tests, and the M6 route gate pass.
- [x] A current production build is served at `KUBEMOTION_BASE_URL` (default
      `http://127.0.0.1:4173`).

`pnpm visual:m7` deliberately stops before opening Chromium if any migration precondition is
missing. Do not weaken that preflight to obtain screenshots from schema-v1 or planned content.

## Representative lesson matrix

| Lesson                               | Stable step ID               | Required grammar    | Acceptance purpose                                                                  | Persistent route |
| ------------------------------------ | ---------------------------- | ------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| Cluster overview                     | `cluster-summary`            | Overview            | Cluster foundation, separated control-plane and worker areas, visible Node context  | No               |
| Pod and placement                    | `logical-ownership`          | Logical Ownership   | Namespace is a logical scope; Nodes are not its children                            | No               |
| Pod and placement                    | `node-runtime-chassis`       | Placement & Runtime | Node chassis, Pod bay placement, and scheduling relation                            | No               |
| Manifest to running Pod              | `submit-deployment-manifest` | Control Flow        | External client enters through the API Server                                       | Yes              |
| Manifest to running Pod              | `scheduler-records-worker-c` | Control Flow        | Scheduler choice is a readable scheduling route                                     | Yes              |
| Manifest to running Pod              | `pod-becomes-ready`          | Placement & Runtime | Assigned Pod and contained Container converge to Running/Ready                      | No               |
| Service and EndpointSlice            | `endpoint-slice-backends`    | Traffic             | Endpoint inventory and readiness evidence without making EndpointSlice a packet hop | No               |
| Service and EndpointSlice            | `request-ready-backend`      | Traffic             | Client → Service → selected Ready Pod remains statically traceable                  | Yes              |
| Container restart vs Pod replacement | `container-restarted`        | Control Flow        | Same Pod identity, new Container runtime identity/restart evidence                  | Yes              |
| Container restart vs Pod replacement | `scheduler-binds-worker-c`   | Control Flow        | Replacement Pod reaches the selected Node through a persistent scheduling route     | Yes              |

Every row is captured at 1440×900, 390×844, and either 1280×720 or 1280×800. The medium height
alternates across objectives so both desktop risk heights are represented without duplicating the
entire matrix. Locale rotation gives every objective one EN, one JA, and one zh-CN capture.
Route objectives add a second screenshot and a replay probe in a `prefers-reduced-motion: reduce`
browser context.

Expected output:

- 30 settled screenshots (10 objectives × 3 viewport/locale cases);
- 15 reduced-motion screenshots (5 route objectives × 3 viewport/locale cases);
- `docs/review/evidence/m7/m7-lesson-visual-manifest.json`;
- a zero-failure manifest status.

## Automated manifest gates

### Scene grammar and density

- [x] The visible view badge matches the required grammar for the representative step.
- [x] Guided scenes remain orthographic.
- [x] Rendered entity handles do not exceed the shared grammar ceiling: 20 desktop, 10 mobile.
- [x] Visible entity labels do not exceed 7 desktop / 3 mobile.
- [x] Visible route labels do not exceed 3 desktop / 1 mobile.
- [x] Focused entity label records do not exceed 3 desktop / 2 mobile, and every representative
      step exposes at least one focused teaching object.
- [x] Required relation handles are present; route handles count as relations only on route
      objectives.
- [x] No visible label overlaps another label, leaves the scene host, leaves the camera safe
      rectangle, or carries the wrong `lang`.
- [x] Focused objects and full scene bounds remain inside their safe rectangles.

### Runtime hierarchy

- [x] Scheduled Pods are inside unique Node bays.
- [x] No Pod overlaps another Pod or a Node system module.
- [x] Pending Pods are outside Nodes.
- [x] Containers are inside their Pod shells.
- [x] kubelet and container-runtime modules, when rendered, are mounted to their Node.
- [x] Objective-specific minimums in the manifest are present (for example Node + Pod + contained
      Container in the Running and restart captures).

### Teaching panel and source evidence

- [x] “What changed,” “Why,” and “Takeaway” each have a non-empty localized heading and body.
- [x] Evidence is visible and contains at least one factual row; the empty-evidence message does
      not satisfy M7.
- [x] The mobile teaching sheet is expanded in the captured state.
- [x] The Sources badge and drawer contain the same non-zero count.
- [x] Every source has a title, authority, `https://kubernetes.io/` URL, safe external-link
      attributes, and a visible verification date.
- [x] Neither the document nor the application root has horizontal overflow.

### Persistent route and reduced motion

- [x] Every route objective has a persistent wide-line route, arrowhead, numbered marker, and
      visible short route label in the settled screenshot.
- [x] The accessible scene summary describes route hops, so static understanding is not visual
      only.
- [x] Route, arrow, and marker stay inside the safe rectangle.
- [x] Obstacle intersections, endpoint drift, replanning failures, sub-4-CSS-pixel routes,
      arrowless routes, and off-route tokens are all zero.
- [x] Wide-line geometry/material counts equal active route-handle count.
- [x] Reduced-motion replay leases zero flow tokens while retaining the route, arrows, markers,
      evidence, and teaching explanation.
- [x] Maximum sampled token-to-route distance remains at or below `0.02`.

## Human PASS/FAIL review

Machine geometry is necessary but not sufficient. Review every PNG at 100% scale and record PASS
or FAIL for each item:

- [x] In five seconds, the intended lesson fact is identifiable without reading the narration.
- [x] The scene uses the named grammar, not the Overview object set rearranged under another badge.
- [x] Primary objects have distinct silhouettes; no key concept has regressed to a generic green
      primitive plus label.
- [x] Logical scope, physical placement, control communication, and application traffic are not
      visually conflated.
- [x] Node → Pod → Container containment is understandable from the models themselves.
- [x] A route screenshot can be traced from source to destination while paused.
- [x] EndpointSlice is selection evidence, never a request hop.
- [x] The selected endpoint or Node is unambiguous.
- [x] Labels, arrows, markers, panels, and teaching text are not clipped or crowded.
- [x] On mobile, the scene and expanded teaching sheet both remain useful; neither is a token
      desktop shrink.
- [x] EN, JA, and zh-CN communicate the same fact and do not expose untranslated placeholders.
- [x] What changed, Evidence, and Takeaway agree with the rendered world state.

Any human FAIL blocks M7 even when the JSON manifest says `pass`. Record the failed filename, the
observable defect, and the corrective commit before rerunning the complete matrix.

Review record (2026-08-08): PASS. All 45 generated PNGs were reviewed after the zero-failure rerun.
The first run correctly exposed a mobile Traffic label outside the safe rectangle; the label
measurement margin was corrected and the complete matrix was regenerated. Logical and Traffic
projections were also confirmed not to be falsely judged as physical Node-bay views.

## Current instrumentation boundary

The visual script checks the observable shared density ceilings, expected view badge, focused
entity label records, and relation-handle minimums. The current browser diagnostics do not expose
`EffectiveScenePlan.grammarId`, primary/secondary entity counts, or the set of visible relation
families. Those semantic-family limits remain covered by CourseEngine/scene-grammar tests and must
not be inferred from line color in screenshots. A later debug bridge may expose these values; if
it does, add them to the M7 manifest rather than replacing the present visual gates.
