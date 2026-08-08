# Foundation-first visual acceptance checklist

This checklist supersedes the earlier release-specific screenshot approval when judging the new
foundation-first rebuild. The earlier 43 screenshots remain useful factual regression evidence, but
they are not visual targets for this directive.

## Milestone 0 baseline review

| Capture                         | Objective                                  | Visible / hidden scope                                                    | Focus / route                              | Labels / relations                                      | Safe frame and collision                                               | Five-second result                                                             | Status      |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| Supplied `current-overview.png` | Record the rejected all-object composition | Many orthogonal dimensions visible together; no meaningful default hiding | No single focus; no dominant traffic route | Dense label and relation field                          | Visible overlaps and ambiguous containment                             | Cannot identify one mental model                                               | REJECTED    |
| Branch Explore Overview         | Measure current Explore default            | 17 entity handles and 17 relation handles                                 | No primary focus; no active route          | 7 entity + 4 layout labels; 0 measured label overlap    | Labels stay in frame, but relation and model density remains excessive | Cluster zones are visible, hierarchy is not immediate                          | FAIL        |
| Service entry                   | Orient the existing traffic lesson         | Client, Service, EndpointSlice, three backends; control plane hidden      | Traffic objects; no route yet              | 5 entity + 3 layout labels; 7 relations                 | 0 measured label overlap; in frame                                     | Entry, inventory, and backends are identifiable                                | LEGACY PASS |
| Service Request A settled       | Verify current persistent route            | Same traffic subset                                                       | Client → Service → selected backend        | 6 entity + 3 layout labels; 8 relations; 2 route labels | 0 measured label overlap; in frame                                     | Static direction and backend are traceable                                     | LEGACY PASS |
| Restart/replacement entry       | Orient the existing lifecycle lesson       | Control, workload, unscheduled, and worker zones                          | Architecture orientation; no active route  | 7 entity + 4 layout labels; 10 relations                | 0 measured label overlap; in frame                                     | Zones are identifiable; 16 entities lack formal primary/context classification | PARTIAL     |
| Explicit-delete route settled   | Verify current API-mediated route          | Lifecycle subset                                                          | Developer/API deletion route               | 7 entity + 4 layout labels; 6 relations; 2 route labels | 0 measured label overlap; in frame                                     | The delete request and target are traceable                                    | LEGACY PASS |

Milestone 0 passes when these starting conditions are faithfully recorded. A failed baseline image
does not block M0; it blocks any claim that the final foundation-first visual gate has passed.

## Foundation gate

- [ ] The cluster boundary is immediately clear.
- [ ] Control Plane and Worker Nodes read as peer semantic islands.
- [ ] The stage does not look like objects dropped on a debug grid.
- [ ] An unscheduled/transit lane is clear when relevant.
- [ ] No giant overlapping translucent regions remain.
- [ ] The scene uses a bounded foundation with readable edge thickness and nameplate.

Baseline result: **FAIL**. Target milestone: M2.

## Hierarchy gate

- [ ] Node chassis has visible mass, name, status rail, local modules, and deterministic Pod bays.
- [ ] Every scheduled Pod visibly occupies exactly one Node bay.
- [ ] Every Container is visibly inside its Pod shell.
- [ ] Pending Pods remain outside all Nodes.
- [ ] Namespace never looks like a physical Node container.
- [ ] Logical ownership and physical placement are separate projections.

Baseline result: **FAIL**. Target milestones: M3–M4.

## Model gate

- [ ] API server, etcd, scheduler, and controller manager have distinct silhouettes.
- [ ] Scheduler reads as a decision module rather than a generic primitive.
- [ ] Controller manager reads as reconciliation without a novelty mesh.
- [ ] Deployment, ReplicaSet, Service, and EndpointSlice are visually distinct.
- [ ] External actors cannot be mistaken for Pods.
- [ ] Neutral surfaces dominate; semantic accents do not create an all-green field.
- [ ] Every primary kind has a dedicated visual module; generic fallback is future-only.

Baseline result: **FAIL**. Target milestone: M4.

## Label gate

- [x] Baseline branch screenshots keep entity-label overlap below the existing threshold.
- [x] Baseline branch screenshots keep labels inside the scene frame.
- [ ] No world label covers a primary object center at all required viewports.
- [ ] Full metadata remains in fixed UI rather than the world.
- [ ] English, Japanese, and Chinese pass the new grammar-specific label budgets.
- [ ] Label stability is verified during camera, layout, and locale changes.

Baseline result: **PARTIAL**. Target milestone: M5.

## Route gate

- [x] The two verified stories already expose persistent wide-line routes.
- [x] Static route screenshots show direction and selected destinations.
- [x] Routed tokens follow the persistent authored path.
- [x] Reduced motion retains route meaning in existing tests.
- [ ] Complete semantic anchors exist on every required model.
- [ ] Routes avoid every unrelated primary model and protected label rectangle.
- [ ] Endpoint inventory, DNS configuration, and Gateway rules remain supporting evidence rather
      than packet hops in all new stories.
- [ ] All eight flow stories pass static, animated, settled, and reduced-motion review.

Baseline result: **PARTIAL**. Target milestones: M6 and M9.

## Teaching gate

- [x] Existing guided steps have What changed, Why, Evidence, Takeaway, sources, and navigation.
- [x] Existing teaching text remains visible on mobile.
- [ ] Every new step has one primary idea and at most two secondary focus objects.
- [ ] Every lesson ends with concise conclusions and prerequisite-correct continuation.
- [ ] Explore defaults to a mental-model view rather than a raw graph composition.
- [ ] Twelve available lessons meet the complete content and screenshot contract.

Baseline result: **PARTIAL**. Target milestones: M7–M10.

## Required final screenshot inventory

The final gate requires all directive captures with a per-image record of objective, visible and
hidden entities, focus, active route, labels, relations, safe frame, collisions, five-second result,
and limitations:

- 1440×900: Overview; Pod/Container; Logical; Placement; Control Flow; Service route before,
  during, and settled; readiness reroute; Container restart; replacement Pending; replacement
  scheduled; rolling-update traffic shift.
- 1280×720: Overview; Service traffic; Control Flow.
- 390×844: Overview; Pod/Container; Service traffic; Container restart; Pending scheduling.

No final PASS may be recorded while any Foundation, Hierarchy, Model, Label, Route, or Teaching item
above remains unchecked.
