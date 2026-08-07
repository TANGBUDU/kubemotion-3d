# Visual acceptance checklist

This is a human review record, not an automatically approved snapshot list. Every PNG below was
opened and inspected after the final capture. Result: **32/32 screenshots PASS** and **30/30
aggregate checks PASS**. The real-scene projection gate separately verified the 6% safe frame for
every non-comparison step at all three required viewport sizes.

`Label count` means entity labels. Zone titles and separately capped relation verbs are not counted
as entity labels.

## Per-screenshot review

### Golden lesson — 1440×900 desktop

| Screenshot                    | Learner should identify                                 | Active focus       | Active route                              | Expected visible evidence                                    | Safe frame | Label count | Known limitations                                         | Result |
| ----------------------------- | ------------------------------------------------------- | ------------------ | ----------------------------------------- | ------------------------------------------------------------ | ---------- | ----------: | --------------------------------------------------------- | ------ |
| `golden-step-00-1440x900.png` | Three zones; Node → Pod → Container hierarchy           | `api-7f8d9-a` Pod  | None                                      | Orientation copy; no factual mutation                        | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-01-1440x900.png` | Healthy baseline and ReplicaSet 3/3/3                   | Original Pod       | None                                      | UID, worker-a, restart 0, generation 1                       | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-02-1440x900.png` | Terminated Container inside intact Pod                  | Original Pod       | None                                      | Container running → terminated; Pod identity unchanged       | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-03-1440x900.png` | Rebuilt Container in the same Pod shell                 | Original Pod       | API Server → kubelet → Container          | restart 0 → 1; generation 1 → 2; UID and Node unchanged      | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-04-1440x900.png` | Explicit kubectl delete, not a process crash            | kubectl            | kubectl → API Server → old Pod location   | Old Pod/Container removed; ReplicaSet 3/2/2                  | PASS       |           7 | Exit route ends at the retained old location              | PASS   |
| `golden-step-05-1440x900.png` | Controller observes deficit and creates a new identity  | Controller Manager | Controller Manager → API Server → new Pod | New UID; Pending; Unscheduled; ReplicaSet 3/3/2              | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-06-1440x900.png` | Pending Pod outside every Node in unscheduled tray      | New Pending Pod    | None                                      | UID; no nodeName; Pending; waiting Container                 | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-07-1440x900.png` | Scheduler binding is separate from runtime start        | Scheduler          | Scheduler → API Server → worker-c         | nodeName worker-c; phase still Pending; ready 2              | PASS       |           7 | Settled frame; movement is covered by the transition gate | PASS   |
| `golden-step-08-1440x900.png` | worker-c kubelet starts Container and readiness returns | New running Pod    | API Server → worker-c kubelet → Container | waiting → running; Pending → Running; ReplicaSet ready 2 → 3 | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-09-1440x900.png` | Restart and replacement histories side by side          | Comparison         | None                                      | Old/stable UID versus removed/new UID and Node               | PASS       |           0 | Dedicated comparison suspends the 3D view                 | PASS   |

### Golden lesson — 1280×720 desktop

| Screenshot                    | Learner should identify                  | Active focus       | Active route                              | Expected visible evidence                | Safe frame | Label count | Known limitations                                         | Result |
| ----------------------------- | ---------------------------------------- | ------------------ | ----------------------------------------- | ---------------------------------------- | ---------- | ----------: | --------------------------------------------------------- | ------ |
| `golden-step-00-1280x720.png` | Three zones and nested runtime hierarchy | Original Pod       | None                                      | Orientation copy                         | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-01-1280x720.png` | Healthy original identity                | Original Pod       | None                                      | UID, worker-a, restart 0, generation 1   | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-02-1280x720.png` | Failed child, intact parent              | Original Pod       | None                                      | terminated Container; unchanged Pod      | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-03-1280x720.png` | In-place restart                         | Original Pod       | API Server → kubelet → Container          | restart/generation plus stable UID/Node  | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-04-1280x720.png` | Intentional whole-Pod deletion           | kubectl            | kubectl → API Server → old Pod location   | Removed identity; ReplicaSet 3/2/2       | PASS       |           7 | Exit route ends at the retained old location              | PASS   |
| `golden-step-05-1280x720.png` | Controller-created replacement           | Controller Manager | Controller Manager → API Server → new Pod | New UID; Unscheduled; ReplicaSet 3/3/2   | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-06-1280x720.png` | Unscheduled tray                         | New Pending Pod    | None                                      | Pending; no nodeName                     | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-07-1280x720.png` | Bound but not started Pod                | Scheduler          | Scheduler → API Server → worker-c         | worker-c; Pending; ready 2               | PASS       |           7 | Settled frame; movement is covered by the transition gate | PASS   |
| `golden-step-08-1280x720.png` | kubelet start/readiness                  | New running Pod    | API Server → kubelet → Container          | running/ready and ReplicaSet 3/3/3       | PASS       |           7 | None observed                                             | PASS   |
| `golden-step-09-1280x720.png` | Clean dedicated comparison               | Comparison         | None                                      | Restart versus replacement identity rows | PASS       |           0 | Dedicated comparison suspends the 3D view                 | PASS   |

### Golden lesson — 390×844 mobile

| Screenshot                   | Learner should identify                     | Active focus    | Active route                     | Expected visible evidence                      | Safe frame | Label count | Known limitations                                 | Result |
| ---------------------------- | ------------------------------------------- | --------------- | -------------------------------- | ---------------------------------------------- | ---------- | ----------: | ------------------------------------------------- | ------ |
| `golden-step-00-390x844.png` | Scene zones plus visible mobile explanation | Original Pod    | None                             | Orientation teaching text                      | PASS       |           3 | None observed                                     | PASS   |
| `golden-step-03-390x844.png` | Same-Pod restart at phone width             | Original Pod    | API Server → kubelet → Container | restart/generation and stable identity context | PASS       |           3 | One relation verb retained at mobile density      | PASS   |
| `golden-step-06-390x844.png` | Pending Pod clearly outside Nodes           | New Pending Pod | None                             | Unscheduled/Pending evidence                   | PASS       |           3 | None observed                                     | PASS   |
| `golden-step-08-390x844.png` | kubelet start route and Ready result        | New running Pod | API Server → kubelet → Container | running/ready evidence                         | PASS       |           3 | One relation verb retained at mobile density      | PASS   |
| `golden-step-09-390x844.png` | Stacked comparison, not a table over 3D     | Comparison      | None                             | Both identity histories                        | PASS       |           0 | Mobile view keeps the four causal comparison rows | PASS   |

### Service lesson

| Screenshot                                   | Learner should identify                               | Active focus         | Active route                     | Expected visible evidence                         | Safe frame | Label count | Known limitations                                       | Result |
| -------------------------------------------- | ----------------------------------------------------- | -------------------- | -------------------------------- | ------------------------------------------------- | ---------- | ----------: | ------------------------------------------------------- | ------ |
| `service-step-00-1440x900.png`               | Client, stable Service, EndpointSlice, three backends | Client Pod           | None                             | ClusterIP and three backend identities            | PASS       |           5 | None observed                                           | PASS   |
| `service-step-03-1440x900.png`               | Request path traceable in under three seconds         | Selected Ready api-a | client → Service → api-a         | Stable ClusterIP; Ready endpoint                  | PASS       |           6 | None observed                                           | PASS   |
| `service-step-04-1440x900.png`               | api-a remains listed NotReady while route uses api-c  | EndpointSlice        | client → Service → api-c         | ready=false for api-a; Service identity unchanged | PASS       |           6 | Non-color ready=false callout retained                  | PASS   |
| `service-step-05-1440x900.png`               | Complete data path versus EndpointSlice API state     | Service              | client → Service → api-c         | Two Ready, one NotReady, stable entry             | PASS       |           6 | None observed                                           | PASS   |
| `service-step-03-1280x720.png`               | Same request path at compact desktop size             | Selected Ready api-a | client → Service → api-a         | ClusterIP and endpoint readiness                  | PASS       |           6 | None observed                                           | PASS   |
| `service-step-03-390x844.png`                | Request route plus teaching text at phone width       | Selected Ready api-a | client → Service → api-a         | ClusterIP and Ready endpoint                      | PASS       |           3 | One relation verb retained at mobile density            | PASS   |
| `golden-step-08-reduced-motion-1280x720.png` | Direction and causal hops without motion              | New running Pod      | API Server → kubelet → Container | Settled running/ready evidence                    | PASS       |           7 | Motion intentionally absent; direction remains explicit | PASS   |

## Mandatory aggregate checklist

### Scene comprehension

- [x] Control Plane zone is immediately visible.
- [x] Worker Nodes are immediately visible.
- [x] Focus Pod is immediately visible.
- [x] Container is visibly inside the Pod.
- [x] Pending Pod is visibly not inside any Node.
- [x] Controller, Scheduler, API Server, and kubelet have distinct silhouettes.
- [x] ReplicaSet visually communicates desired/current/ready.

### Relations

- [x] Current active causal route is visible in a static screenshot.
- [x] Route direction is visible.
- [x] Route is at least 4 CSS px.
- [x] Route does not disappear behind platforms.
- [x] Control and application routes are visibly different.
- [x] Reduced-motion screenshot remains understandable.
- [x] No unexplained direct Controller → Pod magic connection.

### Labels

- [x] No large black metadata slab covers a Pod.
- [x] No label covers the focused entity.
- [x] No label-label collision beyond the 12% threshold.
- [x] Label count stays under the viewport limit.
- [x] Long UID is in EvidencePanel, not floating in the scene.

### Composition

- [x] No focused object is clipped.
- [x] No large unused empty region dominates the scene.
- [x] No important object sits behind the teaching panel.
- [x] Mobile explanation is visible.
- [x] Final comparison does not cover an active 3D scene with a dense table.

### Teaching

- [x] “What changed” is one sentence.
- [x] “Why it happened” names the responsible component.
- [x] Evidence is visible without clicking.
- [x] Takeaway is explicit.
- [x] Container restart and Pod replacement are visually distinguishable.
- [x] Service traffic route can be traced in under three seconds.
