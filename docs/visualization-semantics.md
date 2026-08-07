# Visualization semantics

This document describes the visual language implemented by the current verified lessons. Factual
state comes from compiled `WorldSnapshot` data; layout, emphasis, labels, routes, and animation
explain that state without replacing it.

## Scene zones

Zones organize responsibility and placement before an event is animated. They are stable teaching
landmarks, not Kubernetes API objects.

| Lesson context  | Zone                            | Current meaning                                                                                  |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Pod lifecycle   | `CONTROL PLANE`                 | Simplified API interaction, reconciliation, and scheduling responsibility.                       |
| Pod lifecycle   | `WORKLOAD STATE / UNSCHEDULED`  | ReplicaSet counters and the tray for a Pending Pod that has no assigned Node.                    |
| Pod lifecycle   | `WORKER NODES`                  | Physical placement context for Nodes, embedded kubelets, Pods, and their Container status slots. |
| Service traffic | `CLIENT`                        | The workload that begins a logical application request.                                          |
| Service traffic | `STABLE ENTRY / ENDPOINT STATE` | The stable Service entry and adjacent EndpointSlice API state.                                   |
| Service traffic | `BACKEND PODS`                  | Backend identities whose readiness determines eligibility for new traffic.                       |

> These are teaching zones. They explain responsibility and placement; they are not a claim that every cluster deploys control-plane components in the same physical arrangement.

## Entity visual language

Verified lesson entities use dedicated visuals rather than a generic fallback.

| Entity                | Implemented visual language                                                                  | Factual meaning shown to the learner                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node                  | Dark rack or chassis with visible Pod bays, an embedded kubelet, Node name, and Node status. | Physical placement context. A Pod inside a bay is assigned to that Node.                                                                                                                            |
| Pod                   | Translucent logical shell with a status header or rail and a named child visual.             | Pod UID, assigned Node, phase, and conditions remain separate factual fields. Detailed facts stay in the fixed Evidence panel instead of large world-space metadata slabs.                          |
| Container status slot | Named child inside one Pod, with state-dependent form and status treatment.                  | Stable API-facing slot for one named Container within that Pod; runtime identity and restart evidence come from ContainerStatus fields.                                                             |
| ReplicaSet            | Three-part counter card labelled `SPEC`, `OBSERVED`, and `READY`.                            | `SPEC` maps to `.spec.replicas`; `OBSERVED` maps to `.status.replicas`; `READY` maps to `.status.readyReplicas`.                                                                                    |
| API Server            | Kubernetes API interaction hub in the simplified control story.                              | API-mediated reads, watches, writes, and bindings may pass through it; it is not the cause of a Node-local process restart.                                                                         |
| Controller Manager    | Reconciliation-loop visual with API-mediated control emphasis.                               | Observes workload state and creates a replacement Pod when the ReplicaSet has a replica deficit; it is not a network proxy.                                                                         |
| Scheduler             | Amber scheduling and decision visual.                                                        | Selects a Node for an unscheduled Pod and records the binding through the API; it does not start Containers.                                                                                        |
| kubelet               | Agent embedded in each Node visual.                                                          | Starts assigned Containers and owns the local same-Pod restart route. API observation can remain contextual without becoming the per-crash initiator.                                               |
| Service               | Stable logical entry in the traffic lesson.                                                  | Service identity and address stay stable while eligible backends can change. It is neither a running application Container nor a universal proxy object; concrete data-plane implementation varies. |
| EndpointSlice         | Visible endpoint-state card beside the Service.                                              | Shows endpoint identity and `ready`, `serving`, and `terminating` conditions. It is adjacent API state, not an application packet hop in the current logical path.                                  |

> The stable child entity represents the named Container status slot within one Pod. A runtime restart changes `containerID`, `state`, `lastState`, `ready`, `started`, and `restartCount`; it does not imply that one immutable runtime process survived.

## Persistent relations

Persistent relations describe settled structure in a snapshot. They remain distinct from an active
teaching route, and their line form, routing, width, dashes, direction, and emphasis carry meaning
in addition to color.

| Meaning                 | Visual form                                      | Current role                                                                                       |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| containment             | Physical nesting or a short composition relation | A Pod contains its named Container status slot.                                                    |
| ownership               | Restrained purple relation                       | A ReplicaSet owns its Pods.                                                                        |
| control observation     | Low-emphasis purple relation                     | Preserves API context without claiming that the API Server initiates local restarts.               |
| `endpoint-membership`   | Green relation                                   | Connects an EndpointSlice endpoint record to its backend identity.                                 |
| placement               | Pod settled in a Node bay                        | Shows the assigned Node after scheduling.                                                          |
| scope and configuration | Lower-emphasis contextual relation               | Supplies namespace or configuration context only when the lesson needs it.                         |
| storage                 | Reserved green orthogonal relation               | Reserved for a future verified storage lesson; the current lessons make no storage-behavior claim. |

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

Related documentation:

- [Accuracy policy](./accuracy-policy.md)
- [Architecture](./architecture.md)
- [Content authoring](./content-authoring.md)
- [Source registry](../content/sources.yaml)
