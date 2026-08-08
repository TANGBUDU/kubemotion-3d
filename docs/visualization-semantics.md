# Visualization semantics

This document describes the visual language implemented by the current verified lessons. Factual
state comes from compiled `WorldSnapshot` data; layout, emphasis, labels, routes, and animation
explain that state without replacing it.

## Scene zones

KubeMotion uses six projections of the same synthetic world: Overview, Logical Ownership,
Placement & Runtime, Control Flow, Traffic, and Storage. Their allowlists, relation families,
density profiles, and hierarchy rules are defined in [Scene grammars](./scene-grammars.md). A view
change is therefore a change of teaching projection, not a rearrangement of one universal scene.

Zones organize responsibility and placement before an event is animated. They are stable teaching
landmarks, not Kubernetes API objects.

| Lesson context  | Zone                            | Current meaning                                                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Overview        | `CLUSTER FOUNDATION`            | One bounded teaching surface for the synthetic cluster; it is not a Namespace or Node container.  |
| Overview        | `CONTROL PLANE`                 | API Server, etcd, scheduler, and controller responsibility at cluster overview scale.             |
| Overview        | `WORKER NODES`                  | Up to three Node chassis with representative assigned Pods visibly seated in their bays.          |
| Overview        | `UNSCHEDULED / TRANSIT`         | Separate location for a Pending Pod; remains visible and empty when no Pod is awaiting placement. |
| Pod lifecycle   | `CONTROL PLANE`                 | Simplified API interaction, reconciliation, and scheduling responsibility.                        |
| Pod lifecycle   | `WORKLOAD STATE / UNSCHEDULED`  | ReplicaSet counters and the tray for a Pending Pod that has no assigned Node.                     |
| Pod lifecycle   | `WORKER NODES`                  | Physical placement context for Nodes, embedded kubelets, Pods, and their Container status slots.  |
| Service traffic | `CLIENT`                        | The workload that begins a logical application request.                                           |
| Service traffic | `STABLE ENTRY / ENDPOINT STATE` | The stable Service entry and adjacent EndpointSlice API state.                                    |
| Service traffic | `BACKEND PODS`                  | Backend identities whose readiness determines eligibility for new traffic.                        |

> These are teaching zones. They explain responsibility and placement; they are not a claim that every cluster deploys control-plane components in the same physical arrangement.

## Foundation and semantic-island ownership

Every rendered teaching scene rests on one bounded foundation. `SceneStage` owns that base and only
local alignment marks; the current view layout owns the semantic-island plan, and `SceneRegistry`
owns the corresponding island plates and the unscheduled tray. No entity visual or view may add a
second floor. This single-owner rule prevents the overlapping transparent discs and universal grid
that made the rejected baseline look like one undifferentiated debug scene.

The Cluster marker is a compact boundary plaque at the foundation edge. It means “the synthetic
cluster discussed in this scene.” It does not mean that a Namespace is a physical platform, that a
Namespace contains Nodes, or that every Kubernetes object lives at the same physical level. A
Namespace remains logical scope; a Node remains physical placement; their relationship is taught in
different scene grammars.

Overview and Control Flow use separate projection and layout contracts. Overview establishes the
cluster foundation, control-plane island, worker-node island, and unscheduled/transit lane. Control
Flow keeps only the context needed for one API-mediated causal chain and maps that context onto its
own three-island composition. Changing between them therefore changes the teaching grammar, not
just the position of the camera or the same universal object pile.

## Entity visual language

Verified lesson entities use dedicated visuals rather than a generic fallback.

| Entity                | Implemented visual language                                                                  | Factual meaning shown to the learner                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cluster               | Compact front boundary plaque and short rails; never a floor slab.                           | Identifies the synthetic cluster teaching boundary without implying Namespace/Node containment or adding another physical platform.                                                                 |
| Node                  | Load-bearing chassis with four Pod bays, a separate system-module strip, name, and status.   | Physical placement context. A scheduled Pod inside one bay is assigned to that Node; a Pending Pod must remain outside.                                                                             |
| Pod                   | Translucent shell with two child slots, status rail, UID fingerprint, and conditional badge. | Pod UID, assigned Node, phase, conditions, and aggregate Container restart count remain separate facts. The restart badge appears only when the count is positive.                                  |
| Container status slot | Named solid child mounted in one of the two Pod slots, with a state-dependent shape.         | Stable API-facing slot for one named Container within that Pod; runtime identity and restart evidence come from ContainerStatus fields.                                                             |
| ReplicaSet            | Three-part counter card labelled `SPEC`, `OBSERVED`, and `READY`.                            | `SPEC` maps to `.spec.replicas`; `OBSERVED` maps to `.status.replicas`; `READY` maps to `.status.readyReplicas`.                                                                                    |
| API Server            | Kubernetes API interaction hub in the simplified control story.                              | API-mediated reads, watches, writes, and bindings may pass through it; it is not the cause of a Node-local process restart.                                                                         |
| etcd                  | Three storage columns containing replicated-looking storage cells and one API-facing port.   | Conceptual Kubernetes API data store. In the basic model only the API Server connects to it; the cells are not a literal topology, quorum diagram, or application database.                         |
| Controller Manager    | Reconciliation-loop visual with API-mediated control emphasis.                               | Observes workload state and creates a replacement Pod when the ReplicaSet has a replica deficit; it is not a network proxy.                                                                         |
| Scheduler             | Amber scheduling and decision visual.                                                        | Selects a Node for an unscheduled Pod and records the binding through the API; it does not start Containers.                                                                                        |
| kubelet               | Dedicated agent model mounted in the Node's system-module strip.                             | Starts assigned Containers and owns the local same-Pod restart route. API observation can remain contextual without becoming the per-crash initiator.                                               |
| Container runtime     | Dedicated CRI/execution model mounted separately from kubelet in the Node chassis.           | Executes Containers for the Node through the runtime interface; it is neither a Pod nor the API-facing Container status slot shown inside a Pod.                                                    |
| Service               | Stable logical entry in the traffic lesson.                                                  | Service identity and address stay stable while eligible backends can change. It is neither a running application Container nor a universal proxy object; concrete data-plane implementation varies. |
| EndpointSlice         | Visible endpoint-state card beside the Service.                                              | Shows endpoint identity and `ready`, `serving`, and `terminating` conditions. It is adjacent API state, not an application packet hop in the current logical path.                                  |

> The stable child entity represents the named Container status slot within one Pod. A runtime restart changes `containerID`, `state`, `lastState`, `ready`, `started`, and `restartCount`; it does not imply that one immutable runtime process survived.

## Runtime containment language

Runtime containment must be understandable from model geometry before labels are read. The Node
chassis provides exactly four recessed Pod bays on one side and an independent system-module strip
on the other. Kubelet and Container runtime use different embedded models and different mounts in
that strip. They do not occupy Pod capacity, and a scheduled Pod may not overlap them.

A scheduled Pod is centered on one deterministic bay and fully contained by its footprint. A
Pending Pod has no Node parent and stays in the `UNSCHEDULED / TRANSIT` or workload-state area. No
overflow row is permitted: a fifth scheduled Pod fails the layout gate instead of appearing above,
beside, or through the chassis.

Each Pod exposes two deterministic Container slots inside its translucent shell. A short
eight-segment fingerprint is derived from the Pod UID so Pod identity remains visually stable while
a Container runtime identity changes. A Container uses solid-dot, open-ring, or failure-stripe form
in addition to color for running, waiting, or terminated state. The Pod restart badge is absent at
zero and appears only when the aggregate contained `restartCount` is positive. A third Container is
rejected before it can mutate the two valid slots.

These are enforced relationships, not illustrative proximity. Screenshot diagnostics require zero
scheduled Pods outside bays, duplicate bay assignments, Pod/Pod overlaps, Pod/system-module
overlaps, Pending Pods inside Nodes, orphaned kubelet/runtime models, and Containers outside Pods.
The separate positive counts for mounted system modules and contained Containers prove that a zero
violation count was not achieved by hiding the hierarchy.

## Persistent relations

Persistent relations describe settled structure in a snapshot. They remain distinct from an active
teaching route, and their line form, routing, width, dashes, direction, and emphasis carry meaning
in addition to color.

| Meaning                 | Visual form                                      | Current role                                                                                                                      |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| containment             | Physical nesting or a short composition relation | A Pod contains its named Container status slot.                                                                                   |
| ownership               | Restrained purple relation                       | A ReplicaSet owns its Pods.                                                                                                       |
| control observation     | Low-emphasis purple relation                     | Preserves API context without claiming that the API Server initiates local restarts.                                              |
| API data storage        | Short directed API Server → etcd relation        | Shows the only permitted basic-model client of etcd; no controller, scheduler, kubelet, or application request connects directly. |
| `endpoint-membership`   | Green relation                                   | Connects an EndpointSlice endpoint record to its backend identity.                                                                |
| placement               | Pod settled in a Node bay                        | Shows the assigned Node after scheduling.                                                                                         |
| scope and configuration | Lower-emphasis contextual relation               | Supplies namespace or configuration context only when the lesson needs it.                                                        |
| storage                 | Reserved green orthogonal relation               | Reserved for a future verified storage lesson; the current lessons make no storage-behavior claim.                                |

Endpoint membership records eligibility state but does not create an application-traffic hop.

## Active teaching routes

An active route is an ordered causal explanation owned by the current step. It has explicit source
and target entities, semantic anchors, arrowheads, optional short labels, and a semantic style.

| Route semantic          | Visual form                     | Current role                                                                              |
| ----------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `control` (API/control) | Purple dashed `Line2` route     | Simplified Kubernetes API and controller actions.                                         |
| `scheduling`            | Thick amber directed route      | Scheduler decision and Pod binding.                                                       |
| `node-runtime`          | Short local green or teal route | kubelet restarts a Container in the same Pod or starts an assigned Container on its Node. |
| `data-flow`             | Thick blue directed route       | Logical client request through the stable Service to the selected Ready backend.          |
| `dns`                   | Distinct directed DNS route     | DNS resolution when a lesson explicitly authors that causal step.                         |

Active routes remain visible after their motion completes, so the causal path survives as settled
evidence. Arrowheads preserve direction under reduced motion. EndpointSlice remains beside the
Service as API state and is not inserted into the application route.

Request A and Request B are distinct requests. Request A completes before the readiness change; a
later Request B begins at the client, enters the unchanged Service, and selects a different Ready
backend. The visualization does not move Request A between Pods.

## Labels, Evidence, and comparison

- World-space labels are short, prioritized by focus and selection, and collision-filtered each
  render. Detailed API data belongs in the fixed panels rather than in large labels over the scene.
- Learner Evidence is derived from snapshots and `WorldDiff`, using kind-specific Kubernetes data
  such as Pod conditions, ContainerStatus fields, ReplicaSet counters, and EndpointSlice
  conditions.
- Renderer-only `WorldEntity.status` selects visual treatment such as color, silhouette, and a
  badge. It never appears as a Kubernetes fact in Evidence, comparison rows, inspector facts, or
  the accessible factual summary.
- The lifecycle comparison is generated from compiled snapshots. It has exactly six properties:
  Pod name, Pod UID, Node, Container ID, Container restart count, and Pod object.
- Callouts explain the current step and are removed when that step changes; they do not create new
  factual edges or fields.

## Status and accessibility

Status is never communicated by color alone. The scene combines color with status headers and
rails, text, silhouettes, counters, line patterns, arrowheads, and explicit Evidence values. Pod
phase remains distinct from `ContainersReady` and `Ready`, and ReplicaSet state remains visible as
the `SPEC / OBSERVED / READY` triplet.

The DOM-based Evidence panel, inspector, comparison, headings, and accessible scene summary expose
the same kind-specific data used by the compiled lesson. Route direction and local-versus-control
semantics remain legible through arrowheads, labels, and line patterns. English, Japanese, and
Simplified Chinese localize teaching copy without changing the underlying facts. Reduced-motion
mode shortens or removes large movement while preserving the final state and route direction.

## Animation contract

Animation is presentation over an already compiled transition. Cues can emphasize a diff, move a
pooled token along an owned route, or show entity entry, failure, restart, and removal, but they do
not mutate the factual `WorldSnapshot`. Replay uses the same authored transition and returns to the
same settled state. Cancellation restores presentation baselines before a later step takes over.

Node-mounted kubelet/runtime models and Pod-mounted Containers inherit their parent's movement.
They are excluded from an additional world-space layout interpolation while composed, preventing a
nested child from drifting out of its valid mount during a Node or Pod transition.

> Animation explains a causal teaching sequence between settled snapshots. It is not a packet capture, literal controller timing trace, guaranteed ordering trace, or promise of one Service data-plane implementation.

## Conceptual-model disclaimer

KubeMotion is a conceptual teaching model. Synthetic IDs and timestamps make identity changes
inspectable, while field meanings follow Kubernetes API concepts. Control routes simplify watch,
update, reconciliation, and binding interactions. They do not reproduce every component exchange
or production topology.

Service routing is shown as a logical client-to-Service-to-backend path. A cluster's concrete
data-plane implementation is implementation-dependent. The current verified scope covers the Pod
lifecycle and Service traffic lessons described here; reserved relation styles do not assert
behavior that those lessons do not model.

The foundation and island arrangement is likewise conceptual. It separates logical responsibility,
physical placement, and transit state for teaching clarity; it does not claim a rack topology,
control-plane hosting model, Namespace boundary, network boundary, or etcd deployment topology.

Related documentation:

- [Accuracy policy](./accuracy-policy.md)
- [Architecture](./architecture.md)
- [Content authoring](./content-authoring.md)
- [Source registry](../content/sources.yaml)
