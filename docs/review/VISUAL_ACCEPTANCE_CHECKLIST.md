# Visual acceptance checklist

This is the final human review record for the Kubernetes accuracy correction. Every PNG recorded
in [`screenshots/manifest.json`](./screenshots/manifest.json) was opened after the final build and
checked for factual consistency as well as layout. Result: **43/43 screenshots PASS** — 38
full-page captures and 5 focused captures.

The manifest inspection also passed every deterministic composition gate:

- teaching text visible: 43/43;
- entity labels outside the scene: 0;
- maximum label-to-label overlap: 0.000 (limit: 0.120);
- maximum desktop entity labels: 7 (limit: 7);
- maximum mobile entity labels: 3 (limit: 3).

`Label count` means entity labels. Zone titles and separately capped relation verbs are not counted
as entity labels. A layout-only pass is insufficient: each critical row below also records the
Kubernetes fact that was visibly verified.

## Capture inventory

| Capture group            | Files                                                                         |  Count | Manual result        |
| ------------------------ | ----------------------------------------------------------------------------- | -----: | -------------------- |
| Golden desktop 1440×900  | `golden-step-00-1440x900.png` through `golden-step-09-1440x900.png`           |     10 | PASS                 |
| Golden desktop 1280×720  | `golden-step-00-1280x720.png` through `golden-step-09-1280x720.png`           |     10 | PASS                 |
| Golden mobile 390×844    | Steps 00, 02, 03, 06, 08, and 09                                              |      6 | PASS                 |
| Service desktop 1440×900 | Steps 00, 03, 04, and 05                                                      |      4 | PASS                 |
| Service desktop 1280×720 | Steps 03, 04, and 05                                                          |      3 | PASS                 |
| Service mobile 390×844   | Steps 03 and 05                                                               |      2 | PASS                 |
| Reduced motion 1280×720  | Golden local restart, Golden startup, and Service Request B                   |      3 | PASS                 |
| Focused factual crops    | Golden Evidence Steps 02/03, Service Evidence Steps 04/05, comparison Step 09 |      5 | PASS                 |
| **Total**                |                                                                               | **43** | **43 PASS / 0 FAIL** |

## Golden lesson factual review

The desktop assertions below were checked at both 1440×900 and 1280×720 unless a row says
otherwise.

| Step | Learner-visible factual evidence                                                                                                                                                                                                    | Route and composition evidence                                                                                                           | Result |
| ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
|    0 | Orientation has no factual mutation; the baseline scene separates control plane, unscheduled work, and Worker Nodes.                                                                                                                | Pod contains its named Container status slot; no active causal route.                                                                    | PASS   |
|    1 | Pod phase `Running`, Pod Ready `true`, Container state `running`, Container ID suffix `-01`, restart count 0, and ReplicaSet `SPEC 3 / OBSERVED 3 / READY 3`.                                                                       | Healthy baseline is legible without floating long metadata.                                                                              | PASS   |
|    2 | Container terminated inside intact Pod; Pod phase remains `Running`; `ContainersReady` and Pod Ready change `true → false`; ReplicaSet Ready changes `3 → 2`; UID and Node remain unchanged.                                        | Pod shows `NOT READY`, terminated Container remains contained, and the ReplicaSet plaque and Evidence both settle at `3 / 3 / 2`.        | PASS   |
|    3 | Local kubelet restart; Container ID changes `-01 → -02`; restart count changes `0 → 1`; `lastState` shows `Error` and exit code 1; Pod UID/Node stay unchanged; Pod Ready changes `false → true`; ReplicaSet Ready changes `2 → 3`. | The only primary route is the green local `worker-a kubelet → Container` route. API/control relations remain context, not the initiator. | PASS   |
|    4 | Explicit deletion removes the old Pod and status slot; ReplicaSet becomes `SPEC 3 / OBSERVED 2 / READY 2`.                                                                                                                          | The delete request reaches the API Server; this is distinct from a Container process exit.                                               | PASS   |
|    5 | Controller creates a new Pod UID in `Pending` phase with no Node and a waiting Container; ReplicaSet becomes `3 / 3 / 2`.                                                                                                           | API-mediated controller action is visible; the Pod starts in the unscheduled tray.                                                       | PASS   |
|    6 | The replacement Pod remains Pending, unscheduled, and NotReady.                                                                                                                                                                     | The Pod is visibly outside every Node; no startup route is claimed.                                                                      | PASS   |
|    7 | Scheduler assigns `worker-c`; phase remains `Pending`, `PodScheduled=true`, Pod Ready remains false, and ReplicaSet remains `3 / 3 / 2`.                                                                                            | Scheduling is shown separately from kubelet startup.                                                                                     | PASS   |
|    8 | Kubelet starts the first runtime Container for the replacement Pod; phase becomes `Running`, readiness becomes true, and ReplicaSet becomes `3 / 3 / 3`.                                                                            | The startup route and final plaque agree with Evidence.                                                                                  | PASS   |
|    9 | Snapshot-derived comparison distinguishes stable Pod UID/Node plus changed Container ID from removed/new Pod UIDs and placement.                                                                                                    | Dedicated comparison replaces the 3D scene and remains readable at desktop and mobile widths.                                            | PASS   |

### Golden mobile and reduced-motion checks

| Screenshot                                                 | Visible acceptance evidence                                                                                                        | Result |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `golden-step-02-390x844.png`                               | Phase `Running`, NotReady state, Container termination, and ReplicaSet `3/3/2` Evidence are visible above the timeline.            | PASS   |
| `golden-step-03-390x844.png`                               | Local restart route and Container ID/restart/readiness Evidence are visible; no control-plane route is presented as the initiator. | PASS   |
| `golden-step-08-390x844.png`                               | Replacement Container startup and final `3/3/3` state are visible.                                                                 | PASS   |
| `golden-step-09-390x844.png`                               | Both identity histories remain readable without covering an active 3D scene.                                                       | PASS   |
| `golden-step-03-local-restart-reduced-motion-1280x720.png` | Static green local-runtime route retains direction and `restart locally` label without token motion.                               | PASS   |
| `golden-step-08-reduced-motion-1280x720.png`               | Static startup route retains causal direction and final readiness.                                                                 | PASS   |

## Service lesson factual review

| Step | Learner-visible factual evidence                                                                                                 | Route and composition evidence                                                                                                 | Result |
| ---: | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
|    0 | ClusterIP Service, EndpointSlice, and three Ready Pod-backed endpoints establish the baseline.                                   | EndpointSlice is adjacent API state, not a packet hop.                                                                         | PASS   |
|    3 | Request A begins at the client, enters the unchanged Service, and reaches Ready backend api-a.                                   | Route labels identify Request A and selected api-a; Evidence uses api-a's UID.                                                 | PASS   |
|    4 | api-a remains in the EndpointSlice with `ready=false`, `serving=false`, and `terminating=false`; Endpoint readiness becomes 2/3. | No active ordinary traffic route targets api-a. Copy explicitly says Request A has already completed.                          | PASS   |
|    5 | Distinct Request B begins at the client and selects api-c through the unchanged Service; api-a remains listed but ineligible.    | Route labels identify a new request and selected Ready api-c; Evidence uses api-c's UID. No migration or rerouting is implied. | PASS   |

The Service facts above were checked at both desktop widths. Request A and Request B were also
checked at 390×844. `service-step-05-request-b-reduced-motion-1280x720.png` preserves the complete
static Request B route without relying on token motion.

## Focused factual crops

The four EvidencePanel crops and the comparison crop use the tighter visual-regression settings
(`threshold: 0.15`, `maxDiffPixelRatio: 0.01`).

| Screenshot                               | Required fact visible                                                                                           | Result |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| `evidence-golden-step-02-1280x720.png`   | Running phase, readiness false, ReplicaSet `3/3/2`, stable UID/Node.                                            | PASS   |
| `evidence-golden-step-03-1280x720.png`   | Container ID `-01 → -02`, restart 1, last termination, readiness restored, ReplicaSet `3/3/3`, stable UID/Node. | PASS   |
| `evidence-service-step-04-1280x720.png`  | Full `ready=false · serving=false · terminating=false` tuple with the endpoint still present.                   | PASS   |
| `evidence-service-step-05-1280x720.png`  | Unchanged Service, 2/3 Ready, and selected api-c identity.                                                      | PASS   |
| `comparison-golden-step-09-1280x720.png` | Same-Pod restart and Pod replacement identity histories are distinct.                                           | PASS   |

## Mandatory directive checklist

### ReplicaSet

- [x] No forbidden ReplicaSet status alias remains.
- [x] `.spec.replicas` meaning is represented.
- [x] `.status.replicas` meaning is represented.
- [x] `.status.readyReplicas` meaning is represented.
- [x] UI uses `SPEC / OBSERVED / READY` and never a `Current` counter.

### Container restart

- [x] No synthetic restart-generation field remains.
- [x] Old and new `containerID` values are different.
- [x] `lastState` records the old termination.
- [x] `restartCount` changes `0 → 1`.
- [x] Copy says replacement runtime Container, not the same runtime instance.

### Pod readiness

- [x] Terminated Container leaves Pod phase `Running`.
- [x] Terminated Container makes `ContainersReady=False`.
- [x] Terminated Container makes `Ready=False`.
- [x] ReplicaSet Ready changes `3 → 2`.
- [x] Restart returns readiness `2 → 3`.

### Causal route

- [x] Same-Pod restart active route is local to worker-a.
- [x] API Server is not the active restart initiator.
- [x] Scheduler and ReplicaSet are absent from the restart route.
- [x] API relation remains only dim context.

### EndpointSlice

- [x] `publishNotReadyAddresses=false` is explicit.
- [x] api-a endpoint remains listed.
- [x] api-a has `ready=false`.
- [x] api-a has `serving=false`.
- [x] api-a has `terminating=false`.
- [x] Active ordinary route does not target api-a.

### Request identity

- [x] Request A reaches api-a before readiness changes.
- [x] Request A is not migrated.
- [x] Request B starts later.
- [x] Request B reaches api-c.
- [x] Forbidden migration-style route copy is absent.

### Regression

- [x] Desktop screenshots pass factual manual review.
- [x] Mobile screenshots pass factual manual review.
- [x] Reduced-motion screenshots retain meaning.
- [x] Tight EvidencePanel and comparison screenshot checks pass.
- [x] The 20-cycle dual-lesson resource stress remains bounded.

**Mandatory result: 35/35 PASS; failed items: 0.**
