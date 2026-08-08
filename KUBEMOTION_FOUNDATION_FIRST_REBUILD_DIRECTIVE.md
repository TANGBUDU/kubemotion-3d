# KubeMotion Foundation-First Teaching and Flow-System Rebuild Directive

**Status:** Mandatory implementation directive  
**Repository:** `https://github.com/TANGBUDU/kubemotion-3d`  
**Target:** current working branch based on the latest `main`  
**Reference screenshot:** `KUBEMOTION_CURRENT_OVERVIEW_REFERENCE.png`  
**Priority:** P0 product correction  
**Supersedes:** all previous visual-layout, scene-composition, model-style, relation-rendering, lesson-volume, and flow-story instructions when they conflict with this file  
**Preserves:** validated content schemas, deterministic navigation, read-only/static-first deployment, source attribution, glossary validation, and any already-correct world-state semantics

---

# 0. Operating instruction

Read this document completely before editing code.

Do not respond with another architecture proposal.  
Do not merely restyle CSS.  
Do not add random glow, bloom, or more labels and call the problem solved.  
Do not continue treating the current all-object overview as the visual target.  
Do not implement more moving spheres without implementing persistent visible routes.  
Do not mark a lesson complete merely because YAML validates or an animation cue executes.

Implement the milestones in the order specified in this directive.

At the end of every milestone:

1. run the required automated checks;
2. capture the required screenshots;
3. inspect them against the visual acceptance checklist;
4. commit the milestone with the required commit message;
5. update `docs/review/FOUNDATION_REBUILD_PROGRESS.md`.

When a runtime or context limit prevents completing the full directive in one session:

- finish the current smallest coherent task;
- leave the repository buildable;
- update the progress file with exact completed and remaining items;
- commit the completed work;
- continue from that file in the next session;
- do not restart the design from zero.

The system is not complete until the mandatory acceptance gates pass.

---

# 1. Why this rebuild is required

The current screenshot is rejected as a teaching experience.

It contains many Kubernetes entities, but it does not explain their structure. The visual result is a dense field of similarly colored shapes and labels. Several concepts occupy the same space, objects appear to touch or overlap, and a first-time learner cannot rapidly determine:

- which objects are physical runtime hosts;
- which objects are logical API resources;
- which components belong to the control plane;
- which Pods run on which Nodes;
- which Containers are inside which Pods;
- which lines represent ownership, placement, control, or traffic;
- where an application request starts and ends;
- why an animated sphere is moving through empty space.

The root problem is not only model quality. The current scene mixes multiple orthogonal Kubernetes dimensions in one composition:

- cluster architecture;
- logical namespace scope;
- workload ownership;
- physical placement;
- node runtime components;
- service discovery;
- application traffic;
- control-plane communication;
- external actors.

A single scene must not display all of those dimensions at equal visual priority.

The required correction is **foundation-first progressive disclosure**:

1. establish a clear physical and semantic base;
2. show only one mental model at a time;
3. make containment and placement visually obvious;
4. make abstract objects visually distinct from runtime objects;
5. draw persistent routes before moving tokens;
6. expand the learning system from five available lessons to a coherent curriculum.

---

# 2. Product definition

KubeMotion is an interactive technical teaching system.

It is not:

- a generic 3D graph viewer;
- a pile of Kubernetes objects rendered simultaneously;
- a topology screenshot with floating labels;
- a particle animation showcase;
- a real packet capture;
- a cluster administration dashboard.

The product must teach through three coordinated layers:

## 2.1 Scene

The scene shows the minimum set of objects needed to explain the current concept.

## 2.2 Teaching panel

The panel explains:

- what the learner is looking at;
- what changed;
- why it changed;
- which evidence proves the change;
- what the learner should remember.

## 2.3 Persistent semantic route

When a lesson describes communication or causality, the route is visible before, during, and after any animated token.

A moving token is a directional accent. It is never the primary representation of a relationship or data path.

---

# 3. Five-second comprehension gate

At every guided-learning step, a learner who has not seen the project before must be able to answer the relevant questions within five seconds.

## 3.1 Architecture step

- Where is the control plane?
- Where are the worker Nodes?
- Which boundary represents the cluster?

## 3.2 Runtime step

- Which object is the Node?
- Which object is the Pod?
- Which object is the Container?
- Is the Container visibly inside the Pod?
- Is the Pod visibly placed on the Node?

## 3.3 Logical-workload step

- Which object is the Deployment?
- Which object is the ReplicaSet?
- Which Pods are controlled by that chain?
- Is this ownership visibly different from Node placement?

## 3.4 Traffic step

- Where does the request begin?
- Where does it end?
- What is the stable Service entry?
- Which backend was selected?
- In which direction does the request travel?

## 3.5 Control-flow step

- Which component initiated the action?
- Does the route visibly pass through the API server where appropriate?
- Which component made the scheduling or reconciliation decision?
- Which component performed the local runtime action?

A screenshot that cannot pass the relevant five-second gate is a failed screenshot.

---

# 4. Non-negotiable Kubernetes modeling rules

These rules prevent a visually attractive but conceptually incorrect hierarchy.

## 4.1 Namespace and Node are orthogonal

Never render this as the canonical hierarchy:

```text
Cluster
└── Namespace
    └── Node
        └── Pod
```

That hierarchy is misleading.

The accurate dimensions are:

```text
Logical scope:
Namespace
└── namespaced API objects, including Pods

Physical placement:
Node
└── scheduled Pods
    └── Containers
```

The same Pod participates in both dimensions.

The application must use separate projections or clearly marked linked representations instead of collapsing these dimensions into one parent-child tree.

## 4.2 Control plane and worker Nodes are peers inside the cluster boundary

Do not place the control plane physically “above” worker Nodes in a way that implies an ownership tree. A raised deck is permitted as a visual zone, but the legend must identify it as a teaching layout rather than a literal nested machine.

## 4.3 Deployment and ReplicaSet are not traffic hops

Application packets must not travel through:

- Deployment;
- ReplicaSet;
- Namespace;
- EndpointSlice object;
- HTTPRoute object;
- ConfigMap;
- Secret.

These resources can influence configuration, selection, and desired state, but they are not generic runtime proxy processes.

## 4.4 EndpointSlice is not a packet-processing box

In a Service lesson:

- display EndpointSlice as an endpoint inventory;
- highlight the chosen endpoint row;
- draw membership/configuration links;
- draw the application route from the client through the logical Service entry to the selected backend;
- do not imply that a packet physically enters and exits an EndpointSlice process.

## 4.5 HTTPRoute is configuration, not a data-plane process

In a Gateway lesson:

- show HTTPRoute rules beside or above the Gateway data plane;
- highlight the matched rule;
- keep packet motion on the Gateway data-plane route;
- do not make the ball fly through an HTTPRoute card.

## 4.6 Scheduler does not start Containers

Separate:

1. a Pending Pod object exists;
2. Scheduler selects a Node and records the binding through the API;
3. kubelet observes the assigned Pod;
4. the container runtime starts Containers;
5. readiness may later become true.

## 4.7 Container restart is not Pod replacement

Keep visibly separate:

```text
Container restart
- same Pod UID
- same Node
- restartCount increases
- Container instance/generation changes

Pod replacement
- old Pod UID disappears
- new Pod UID appears
- new Pod may use a different Node
- controller restores desired replica count
```

---

# 5. Replace the universal “everything view” with scene grammars

The existing application may keep a free Explore mode, but guided teaching and the default overview must use view-specific scene grammars.

Create a formal scene-grammar layer.

Suggested path:

```text
src/renderer/scene-grammar/
├── SceneGrammar.ts
├── OverviewGrammar.ts
├── LogicalOwnershipGrammar.ts
├── PlacementRuntimeGrammar.ts
├── ControlFlowGrammar.ts
├── TrafficGrammar.ts
├── StorageGrammar.ts
├── SceneDensityBudget.ts
└── SceneVisibilityPolicy.ts
```

Each grammar controls:

- allowed entity kinds;
- default hidden entity kinds;
- semantic zones;
- layout algorithm;
- label budget;
- relation budget;
- camera type;
- active route rules;
- object aggregation behavior;
- minimum separation;
- mobile simplification.

---

# 6. Required view definitions

## 6.1 Overview: Cluster foundation

Purpose:

- teach cluster boundary;
- distinguish control plane from worker Nodes;
- show a small number of representative Pods.

Default visible objects:

- one cluster foundation;
- API server;
- etcd;
- scheduler;
- controller manager;
- three worker Nodes;
- at most four representative Pods;
- optional one external developer, only when explaining API entry.

Default hidden objects:

- all Deployments;
- all ReplicaSets;
- all Services;
- all EndpointSlices;
- all Namespaces as standalone 3D blocks;
- all ContainerRuntime labels;
- all kubelet labels unless a Node is focused;
- browser/client unless traffic is being taught;
- detailed ownership lines.

The overview must not repeat the rejected screenshot by placing every entity in the scenario at once.

## 6.2 Logical ownership view

Purpose:

- teach Namespace scope;
- Deployment → ReplicaSet → Pod ownership;
- distinguish desired-state controllers from runtime placement.

Visible structure:

```text
Namespace workspace
├── Deployment blueprint
├── ReplicaSet replica controller
└── Pod identity cards or linked Pod mirrors
```

Node placement must appear only as a compact badge, mini-map, or cross-view link:

```text
api-a Pod
node: worker-a
```

Do not render full Node chassis in the same primary layer unless the lesson explicitly compares logical scope and physical placement.

## 6.3 Placement and runtime view

Purpose:

- teach Node → Pod → Container;
- show kubelet and container runtime as Node-local components;
- show Pending Pods outside all Nodes.

Visible structure:

```text
Cluster runtime foundation
├── worker-a chassis
│   ├── kubelet module
│   ├── runtime module
│   └── Pod bays
├── worker-b chassis
└── worker-c chassis

Unscheduled queue
└── Pending Pod
```

Default hidden objects:

- Deployment;
- ReplicaSet;
- Service;
- EndpointSlice;
- Namespace cards;
- etcd;
- unrelated control-plane components.

Scheduler and API server may appear when explaining scheduling.

## 6.4 Control-flow view

Purpose:

- explain API-mediated causality.

Visible structure:

```text
Developer / kubectl
        ↓
    API Server ↔ etcd
        ↕
Controller Manager
Scheduler
        ↕
kubelet on one focused Node
        ↓
focused Pod and Container
```

Show only one workload chain and one or two Nodes unless comparison requires more.

## 6.5 Traffic view

Purpose:

- show a static-readable request path.

Visible structure for internal traffic:

```text
client Pod
    ↓
Service logical entry
    ↓
selected ready endpoint
    ↓
backend Pod
```

Supporting configuration:

- EndpointSlice card with endpoint rows;
- label selector badge;
- nonselected backend Pods;
- Nodes as low-priority context.

Default hidden objects:

- controller manager;
- scheduler;
- etcd;
- Deployment;
- ReplicaSet;
- unrelated Services;
- unrelated EndpointSlices;
- unrelated Pods.

## 6.6 External traffic view

Visible structure:

```text
Browser
  ↓
Public DNS or resolved address
  ↓
External load balancer / Gateway data plane
  ↓
Service
  ↓
selected endpoint
  ↓
Pod
```

GatewayClass and HTTPRoute appear as configuration cards, not physical packet hops.

## 6.7 Storage view

Purpose:

- show attachment and persistence.

Visible structure:

```text
Pod
├── Container
└── mount
    ↓
PVC request
    ↓
PV
    ↓
storage backend
```

Hide unrelated network and control-plane entities.

---

# 7. Foundation-first stage architecture

The stage must be built from a clear base instead of placing entities directly on a global debug grid.

## 7.1 Cluster foundation

Create a bounded cluster foundation:

- rounded rectangular footprint;
- visible edge thickness;
- subtle top surface;
- cluster title engraved or displayed on a front plaque;
- soft contact shadow;
- no giant intersecting transparent discs;
- no full-screen infinite grid as the dominant visual.

The foundation represents a teaching boundary.

It must not imply that Namespace and Node are physically nested.

## 7.2 Semantic islands

For Overview and Control Flow, use distinct islands on the cluster foundation:

```text
CONTROL PLANE ISLAND
WORKER NODES ISLAND
UNSCHEDULED / TRANSIT LANE
```

Each island needs:

- a base plate;
- a clear heading;
- consistent orientation;
- enough spacing between entities;
- no overlap with another island;
- a brief legend stating that this is a logical teaching arrangement.

## 7.3 Node foundation

Each Node is a substantial chassis, not a capsule or blob.

Required Node anatomy:

```text
Node chassis
├── front nameplate
├── Ready / NotReady status rail
├── kubelet module
├── container runtime module
├── resource strip
├── Pod bay 1
├── Pod bay 2
├── Pod bay 3
└── Pod bay 4
```

The Node must have enough scale and visual mass that a Pod clearly sits **inside/on** it.

## 7.4 Pod bay placement

Pods must snap to deterministic bay anchors.

Requirements:

- no Pod overlaps another Pod;
- no Pod overlaps kubelet or runtime modules;
- no label overlaps a bay occupant;
- every scheduled Pod belongs to exactly one visible Node bay;
- a Pending Pod is in an unscheduled tray, never near a Node bay;
- a newly scheduled Pod visibly moves from the tray to a selected bay;
- placement remains understandable without animation.

## 7.5 Pod containment

A Pod must visibly contain one or more Container modules.

Required Pod anatomy:

```text
Pod shell
├── short Pod name
├── phase/status strip
├── UID identity indicator, not the full UID
├── Container slot(s)
└── restart badge only when relevant
```

The full UID belongs in the Evidence panel.

## 7.6 Container runtime module

The container runtime is embedded in the Node chassis.

It is not another floating green shape.

Use a local system module with:

- runtime glyph;
- short label shown only when focused;
- a local route to the selected Pod/Container when teaching startup;
- no full-time floating label.

## 7.7 kubelet module

The kubelet is also embedded in the Node chassis.

It must be visually distinct from the container runtime:

- kubelet = local agent / reconciliation module;
- runtime = container execution module.

Do not merge them into one unlabeled blob.

---

# 8. Visual language and art direction

## 8.1 Required art direction

Use:

> premium technical diorama / infrastructure explainer

Do not use:

- abstract low-poly rocks;
- identical green blobs;
- torus knots as controllers;
- cones as schedulers;
- random primitives with labels;
- neon wireframe on every object;
- all-green success-state rendering;
- debug-grid aesthetics;
- excessive bloom;
- transparent overlapping discs;
- giant black metadata billboards.

## 8.2 Color hierarchy

Use neutral materials for most object surfaces.

Suggested semantic accents:

| Meaning | Accent |
|---|---|
| Control plane/API | violet |
| Scheduling | amber |
| Runtime/Node placement | blue-gray |
| Pod shell | neutral-blue |
| Running Container | green accent |
| Service/data flow | cyan-blue |
| DNS | teal |
| Storage | green-teal |
| Warning/Pending | amber |
| Failure | coral-red |
| Configuration | muted violet-gray |

No category should be represented only by color. Silhouette and iconography must also differ.

## 8.3 Surface hierarchy

Suggested visual balance:

- 65–75% neutral dark blue/graphite surfaces;
- 15–25% semantic accents;
- 5–10% active glow or highlighted route.

## 8.4 Geometry rules

All primary objects require:

- rounded or beveled edges;
- coherent scale;
- clear front orientation;
- readable silhouette;
- contact shadow;
- consistent detail density;
- reusable geometry where possible.

Avoid high polygon counts. Quality should come from proportion, material, silhouette, hierarchy, and lighting, not excessive mesh complexity.

## 8.5 Lighting

Implement:

- one soft key light;
- one low-intensity fill light;
- soft shadows;
- restrained ambient light;
- correct output color space;
- ACES filmic tone mapping;
- optional subtle contact shadows;
- selective glow only for active routes and primary focus.

## 8.6 Floor and background

Replace the dominant global grid with:

- dark gradient background;
- bounded stage;
- subtle local lane markings;
- faint alignment marks only where useful;
- low-contrast floor.

The floor must never be brighter or busier than the entities.

---

# 9. Entity model acceptance specifications

## 9.1 Cluster

Must look like:

- a bounded system foundation;
- two or more semantic islands;
- a front cluster nameplate;
- optional boundary pulse when introduced.

Must not look like:

- a huge transparent dome;
- a generic plane;
- a giant nested container holding Namespaces and Nodes as children.

## 9.2 API server

Visual metaphor:

- central API gateway / hub;
- multiple controlled anchor ports;
- API glyph;
- subtle violet accent;
- prominent but not oversized.

Must support route anchors for:

- developer/kubectl;
- controller manager;
- scheduler;
- kubelet;
- etcd.

## 9.3 etcd

Visual metaphor:

- compact replicated datastore module;
- cylinder stack or storage cells;
- clear `etcd` label;
- connection only to API server in the basic mental model.

Do not use the same shape as API server.

## 9.4 Controller manager

Visual metaphor:

- reconciliation loop;
- two clean circular arrows;
- central controller module;
- clear distinction from scheduler.

Do not use TorusKnotGeometry.

## 9.5 Scheduler

Visual metaphor:

- decision/routing hub;
- one pending input;
- multiple Node candidates;
- selected output;
- amber accent.

Do not use ConeGeometry as the final design.

## 9.6 Namespace

Namespace is a logical scope.

In logical view, represent it as:

- a clearly titled workspace or bordered board;
- not a thick runtime object;
- not a giant translucent disc under unrelated components.

In other views, use:

- a small namespace badge on namespaced resources;
- or hide it.

## 9.7 Deployment

Visual metaphor:

- application blueprint;
- version/strategy badge;
- declared replica count;
- rollout arrow;
- clearly configuration/control, not runtime.

## 9.8 ReplicaSet

Visual metaphor:

- replica controller card;
- desired/current/ready counters;
- miniature replica slots;
- visible deficit state.

Example:

```text
API REPLICASET
desired  3
current  2
ready    2
● ● ○
```

## 9.9 Pod

Visual metaphor:

- translucent but solidly outlined shell;
- short title bar;
- status rail;
- contained Container modules;
- distinct selected state;
- no giant text slabs.

## 9.10 Container

Visual metaphor:

- solid runtime module inside Pod;
- running/waiting/terminated states differ by shape and symbol as well as color;
- restart animation occurs inside the same Pod shell.

## 9.11 Service

Visual metaphor:

- stable logical portal or virtual address module;
- short name;
- ClusterIP displayed in the side panel;
- no implication that it is always a standalone proxy process.

## 9.12 EndpointSlice

Visual metaphor:

- endpoint inventory card;
- visible rows/chips;
- endpoint IP;
- ready/serving/terminating state;
- target Pod association;
- selected row highlight.

## 9.13 External client

Use a clear client/browser terminal shape or icon card.

Do not render the browser as the same green runtime blob used for Pods.

## 9.14 Developer/kubectl

Use a small terminal/CLI station outside the cluster foundation.

The control route enters the API server.

---

# 10. Density and separation budgets

Create an explicit `SceneDensityBudget`.

## 10.1 Desktop limits

For a normal guided step:

- maximum primary visible entities: 12;
- maximum secondary context entities: 8;
- maximum visible entity labels: 7;
- maximum active relation labels: 3;
- maximum simultaneous focused objects: 3;
- maximum animated tokens: 6;
- maximum visible semantic relation families: 2, plus the active route.

## 10.2 Mobile limits

- maximum primary visible entities: 7;
- maximum visible labels: 3;
- maximum focused objects: 2;
- maximum relation labels: 1;
- aggregate nonessential peer Pods;
- hide secondary control-plane objects unless they are part of the active explanation.

## 10.3 World-space separation

For each layout:

- compute world-space AABBs;
- maintain a configurable horizontal clearance;
- maintain a configurable label clearance;
- do not allow AABBs of unrelated primary objects to overlap;
- do not allow entity centers to be closer than their collision radii plus margin;
- do not place route labels on top of entities;
- do not place Pods at the visual edge of Node chassis.

Use deterministic collision resolution, not random jitter.

## 10.4 Screen-space separation

At required viewport sizes:

- project entity bounds;
- test overlap;
- test UI exclusion rectangles;
- test labels;
- test arrowheads;
- test focused object safe frame.

---

# 11. Camera requirements

## 11.1 Guided learning

Use an orthographic or low-distortion isometric camera by default.

The camera should make the scene read like a technical diagram with depth.

## 11.2 Explore mode

Perspective camera may remain available.

Explore mode still needs:

- object spacing;
- view filters;
- label budgets;
- a clear reset view;
- category toggles.

## 11.3 Safe viewport

The camera framer must know:

- header rectangle;
- teaching panel rectangle;
- timeline rectangle;
- mobile sheet rectangle;
- safe margin.

Fit the relevant scene bounds into the remaining area.

Do not rely only on hard-coded camera positions.

## 11.4 Camera transition

Camera transitions must:

- be cancelable;
- end deterministically;
- not leave stale controls;
- avoid passing through geometry;
- preserve context where possible;
- snap instantly in reduced-motion mode.

---

# 12. Label system redesign

## 12.1 Label priority classes

1. semantic zone heading;
2. primary focused entity;
3. active route marker;
4. selected secondary entity;
5. context entity;
6. hidden/omitted.

## 12.2 Label content

Use short labels in the scene:

```text
API Server
worker-a
api-a
api Service
```

Move detailed fields to fixed UI:

```text
api-object:namespaced:shop:Pod:api-a
UID: synthetic-uid-a1
Node: worker-a
restartCount: 1
```

## 12.3 Collision behavior

Implement:

- projected screen coordinates;
- bounding rectangles;
- priority sorting;
- overlap detection;
- offset candidates;
- hiding of low-priority labels;
- stable placement across frames;
- leader line only for focused callouts.

No label may cover the center of the primary focused object.

## 12.4 Mixed-language text

Support English, Japanese, and Chinese without changing scene geometry unpredictably.

Use:

- width constraints;
- ellipsis for world labels;
- full text in panel;
- language-specific label budget tests.

---

# 13. Persistent relation and route engine

The current “sphere moves between entity positions” behavior is insufficient.

Create a route system separate from transient tokens.

Suggested structure:

```text
src/renderer/routes/
├── RouteDefinition.ts
├── RouteRegistry.ts
├── RoutePlanner.ts
├── RouteAnchorRegistry.ts
├── RouteObstacleMap.ts
├── WideRouteHandle.ts
├── ArrowheadPool.ts
├── FlowTokenPool.ts
├── RouteLabelManager.ts
├── RouteLegend.ts
└── RouteDiagnostics.ts
```

## 13.1 Two layers

### Semantic relation layer

Displays stable facts:

- owns;
- scheduled-on;
- selects;
- endpoint membership;
- stores-in;
- watches/observes;
- mounts.

### Active story route layer

Displays the current causal or traffic path.

The active route is:

- thicker;
- brighter;
- directional;
- visible before token motion;
- visible after token motion;
- readable in reduced-motion mode.

## 13.2 Wide-line implementation

For primary routes, use one of:

1. `Line2`, `LineGeometry`, `LineMaterial`;
2. a camera-facing ribbon mesh;
3. a narrow tube for selected world-space routes.

Do not depend on `LineBasicMaterial.linewidth`.

Requirements:

- active route width: 4–6 CSS px;
- context route width: 1.5–2.5 CSS px;
- update resolution on resize;
- arrowheads;
- optional animated dash offset;
- proper disposal;
- deterministic points.

## 13.3 Route anchors

Every entity visual must expose semantic anchors:

```ts
type RouteAnchorKind =
  | 'api-in'
  | 'api-out'
  | 'control'
  | 'network-in'
  | 'network-out'
  | 'storage'
  | 'ownership'
  | 'placement'
  | 'local-runtime'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';
```

Do not always route center-to-center.

## 13.4 Obstacle avoidance

The route planner must:

- build obstacle rectangles/AABBs from primary objects;
- reserve routing lanes between semantic zones;
- avoid crossing unrelated entity geometry;
- avoid passing under Node chassis;
- avoid label rectangles;
- minimize crossings;
- prefer orthogonal or controlled Bézier paths;
- support multi-hop routes.

## 13.5 Static readability

Before token movement begins:

- route is visible;
- start and end are visible;
- arrow direction is visible;
- active backend is visible;
- supporting configuration is highlighted.

After movement ends:

- route remains visible until the step changes.

## 13.6 Reduced motion

Reduced motion must:

- skip token interpolation;
- retain route;
- retain arrowheads;
- retain selected endpoint;
- retain numbered hop markers;
- retain evidence changes.

## 13.7 Request and response

For traffic stories, support:

- outbound request token;
- optional return response token;
- different direction;
- clear pause between request and response;
- do not continuously loop unless user presses replay.

## 13.8 No token without a route

Automated validation must fail when:

- a `data-packet`, `dns-query`, or `api-request` cue has no associated persistent route;
- a route has fewer than two valid anchors;
- a token uses a free-floating list of entity positions not represented by route geometry.

---

# 14. Relation visual semantics

| Relation | Style | Default state |
|---|---|---|
| Containment | physical nesting, usually no external line | always visible |
| Ownership | thin curved violet line | only in logical view |
| Placement | physical placement; optional short blue anchor | placement view |
| API/control | dashed violet line | control view |
| Scheduling decision | thick amber active route | active scheduling step |
| Application traffic | thick solid cyan-blue route | traffic view |
| DNS query | dashed teal route | DNS step |
| Endpoint membership | thin green links from endpoint rows | Service lesson |
| Storage mount | thick green-teal orthogonal route | storage view |
| Configuration influence | subtle dotted line | only when explicitly taught |

Never display every relation family at once.

---

# 15. Flow-story engine requirements

Create first-class flow stories rather than treating motion as a lesson transition side effect.

Suggested data model:

```ts
interface FlowStory {
  id: string;
  title: LocalizedText;
  scenarioId: string;
  view: SceneView;
  steps: FlowStoryStep[];
  sources: string[];
  verifiedAt: string;
}

interface FlowStoryStep {
  id: string;
  title: LocalizedText;
  worldPatch?: WorldPatch;
  projectionPatch: SceneProjectionPatch;
  routeIds: string[];
  selectedRouteId?: string;
  explanation: {
    whatChanged: LocalizedText;
    why: LocalizedText;
    evidence: EvidenceRule[];
    takeaway: LocalizedText;
  };
  playback?: {
    tokenType: 'request' | 'response' | 'dns' | 'api';
    routeId: string;
    durationMs: number;
    count?: number;
  };
}
```

Adapt the exact types to the current architecture, but preserve these semantics.

A flow story step must never consist only of:

```yaml
transition:
  type: data-packet
  path: [...]
```

It must define a persistent route and an explanation.

---

# 16. Mandatory flow stories

Implement at least the following eight stories.

The first four are P0 for the next usable release.

## Story 1 — Manifest to running Pod

Path and causality:

```text
Developer / kubectl
→ API Server
↔ etcd
→ Controller Manager reconciliation
→ Pod object created
→ Scheduler observes Pending Pod
→ binding recorded through API Server
→ kubelet observes assignment
→ container runtime starts Container
```

Important:

- use API-mediated control routes;
- do not imply literal direct process invocation where the model is simplified;
- distinguish object creation from runtime startup.

## Story 2 — Internal Service request

Static-readable application route:

```text
client web Pod
→ api Service logical entry
→ selected ready endpoint
→ api backend Pod
```

Supporting configuration:

- selector badge;
- EndpointSlice rows;
- selected endpoint row;
- other ready endpoints visible but dimmed.

The route must be clearly visible without animation.

## Story 3 — DNS and Service discovery

Two distinct phases:

```text
client Pod
→ CoreDNS query
← Service name resolution

client Pod
→ Service
→ backend Pod
```

Use different line style and token for DNS.

## Story 4 — Container restart versus Pod replacement

Two comparison sequences:

### Restart

```text
Container exits
→ kubelet restarts Container locally
→ same Pod UID
→ same Node
→ restartCount +1
```

### Replacement

```text
Pod deleted or lost
→ ReplicaSet deficit
→ new Pod identity
→ scheduling
→ kubelet startup
```

Do not imply that a Container crash automatically causes Pod replacement.

## Story 5 — Readiness failure removes traffic eligibility

```text
Pod remains Running
→ readiness fails
→ endpoint ready condition changes
→ traffic route shifts to another ready backend
```

The Service address remains stable.

## Story 6 — Rolling update with traffic shift

```text
Deployment revision changes
→ new ReplicaSet
→ new Pod starts
→ becomes Ready
→ endpoint set expands
→ traffic can use new Pod
→ old Pod terminates
```

Do not send traffic to an unready Pod.

## Story 7 — External browser request

```text
Browser
→ public DNS
→ external load balancer / Gateway data plane
→ Service
→ selected endpoint
→ Pod
```

Show Gateway/HTTPRoute configuration beside the data plane, not as physical packet hops.

## Story 8 — HPA scale-out

```text
metric rises
→ HPA changes desired replicas
→ Deployment/ReplicaSet creates Pods
→ scheduler places Pods
→ kubelet starts Containers
→ EndpointSlice adds ready backends
→ traffic fan-out expands
```

Clarify that HPA changes desired replicas; it does not directly start Containers.

---

# 17. Course expansion requirement

The current release exposes only five available lessons. That is insufficient for a public teaching system.

The next curriculum milestone must provide at least **12 complete, interactive, source-verified lessons**.

The project roadmap may list more, but the UI must clearly distinguish:

- complete interactive lesson;
- preview;
- planned lesson.

Do not describe planned placeholder entries as completed learning content.

---

# 18. Required 12-lesson core curriculum

## Chapter 1 — Build the mental model

### Lesson 1: Why Kubernetes exists

Learning outcome:

- distinguish container packaging from orchestration;
- understand desired state at a high level.

Scene:

- one simple application;
- one failure;
- desired vs actual count;
- controller restores state.

### Lesson 2: Cluster, control plane, and worker Nodes

Learning outcome:

- identify cluster boundary;
- distinguish control-plane responsibility from worker execution.

Scene:

- foundation Overview;
- no Workload/Networking object soup.

### Lesson 3: Pod and Container

Learning outcome:

- understand Pod as the deployable unit;
- see Container inside Pod;
- understand shared Pod context at a simple level.

Scene:

- one Node;
- one Pod;
- one and then two Containers.

### Lesson 4: Namespace and Node are different dimensions

Learning outcome:

- Namespace = logical scope;
- Node = physical placement;
- same Pod participates in both.

Scene:

- explicit transition between Logical and Placement views;
- no false nested hierarchy.

## Chapter 2 — From desired state to runtime

### Lesson 5: Deployment, ReplicaSet, and Pods

Learning outcome:

- Deployment manages rollout;
- ReplicaSet maintains replica count;
- Pods are replaceable instances.

Scene:

- logical ownership grammar;
- counters and replica slots.

### Lesson 6: Manifest to running Pod

Learning outcome:

- follow API, controller, scheduler, kubelet, runtime responsibilities.

Scene:

- control-flow story with persistent routes.

### Lesson 7: Pending Pod and scheduling

Learning outcome:

- creation and scheduling are separate;
- Scheduler chooses a Node;
- kubelet starts the workload later.

Scene:

- unscheduled tray;
- candidate Nodes;
- amber scheduling route.

### Lesson 8: Container restart vs Pod replacement

Learning outcome:

- compare identity and placement changes.

Scene:

- runtime grammar;
- fixed Evidence panel;
- comparison view.

## Chapter 3 — Stable networking over changing Pods

### Lesson 9: Labels and selectors

Learning outcome:

- label metadata;
- selector membership;
- mismatch demonstration.

Scene:

- logical view;
- matching Pods highlighted;
- no traffic yet.

### Lesson 10: Service and EndpointSlice

Learning outcome:

- Service stable access;
- EndpointSlice backend inventory;
- backend set can change.

Scene:

- Service portal;
- endpoint list;
- membership links.

### Lesson 11: Internal request and DNS

Learning outcome:

- resolve Service name;
- follow request to one ready backend.

Scene:

- first complete traffic view;
- persistent routes.

## Chapter 4 — Resilience

### Lesson 12: Probes and rolling update

This may be split into two lessons when implementation quality is maintained:

- Startup, Readiness, Liveness;
- Rolling update and traffic eligibility.

Minimum next release count remains 12; splitting raises the count to 13 and is encouraged.

---

# 19. Expansion curriculum after the first 12

Prepare schemas and roadmap, but do not lower quality to mark these available prematurely.

## Networking and external traffic

- Pod network and CNI;
- Service types;
- Gateway API;
- Ingress and Gateway comparison;
- complete external request;
- NetworkPolicy introduction.

## Configuration and storage

- ConfigMap and Secret;
- ephemeral storage;
- PVC, PV, StorageClass;
- StatefulSet identity and storage.

## Resources and scaling

- requests and limits;
- Pending due to resources;
- HPA;
- common failure states;
- final 503 diagnosis challenge.

Target public curriculum after the core rebuild:

- 20–22 interactive lessons;
- 8 flow stories;
- 3 diagnostic challenges.

---

# 20. Lesson authoring rules

## 20.1 Step count

Each lesson:

- 4–8 normal steps;
- up to 10 only for a justified full causal story;
- no step that merely moves a token without teaching a new fact.

## 20.2 Per-step structure

Every step must contain:

1. scene orientation or changed focus;
2. `What changed`;
3. `Why it happened`;
4. evidence;
5. takeaway;
6. source references.

## 20.3 New concepts

- define every new term at first use;
- no more than three new terms in one step;
- no more than eight new terms in a short lesson;
- glossary validation remains mandatory.

## 20.4 Visual focus

Each normal step:

- exactly one primary focus;
- at most two secondary focus objects;
- all unrelated objects dimmed or hidden;
- active route is the strongest visual element.

## 20.5 Summary

Every lesson ends with:

- 2–4 concise conclusions;
- a small comparison or mini-map;
- no dense spreadsheet over an active 3D scene;
- link to the next prerequisite-appropriate lesson.

---

# 21. Teaching panel redesign

Use a fixed panel instead of relying on world labels.

Suggested structure:

```text
STEP 3 OF 7

Container exits

WHAT CHANGED
The Container stopped, but the Pod still exists.

WHY
The kubelet can restart a failed Container inside the assigned Pod.

EVIDENCE
Pod UID             unchanged
Node                worker-a
restartCount        0 → 1
Container instance  1 → 2

TAKEAWAY
A Container restart does not create a new Pod.
```

Requirements:

- concise text;
- no long prose wall;
- evidence generated from state/diff where possible;
- visible source link;
- replay button;
- previous/next;
- keyboard support;
- mobile sheet version.

---

# 22. Explore mode redesign

Explore mode may show more than guided lessons, but it must not default to the rejected “all entities at once” arrangement.

## 22.1 Default Explore entry

Start with Overview grammar:

- cluster foundation;
- control plane;
- Nodes;
- representative Pods.

## 22.2 View switcher

Provide explicit views:

- Overview;
- Logical;
- Placement;
- Control Flow;
- Traffic;
- Storage.

The user must understand that these are different projections of the same synthetic cluster.

## 22.3 Category filters

Allow toggles:

- API objects;
- runtime components;
- infrastructure;
- external actors;
- ownership;
- placement;
- configuration;
- control;
- traffic.

Default filters depend on the selected view.

## 22.4 Detail on demand

- click entity to open Inspector;
- do not show full metadata labels on all entities;
- highlight neighbors;
- show relation list;
- provide `Focus in Logical View`, `Focus in Placement View`, and `Show Traffic` actions.

## 22.5 Automatic clustering

When a view contains many peer Pods:

- use compact formation;
- aggregate off-focus Pods;
- expand on selection;
- preserve deterministic layout.

---

# 23. UI layout requirements

## 23.1 Desktop guided lesson

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: course / lesson / progress / language / replay       │
├───────────────────────────────────────────────┬──────────────┤
│                                               │ Teaching     │
│                 3D STAGE                      │ panel        │
│                                               │ Evidence     │
│                                               │ Sources      │
├───────────────────────────────────────────────┴──────────────┤
│ Compact step timeline and Previous / Next                    │
└──────────────────────────────────────────────────────────────┘
```

Scene width:

- at least 68% at 1440 px desktop;
- teaching panel approximately 320–380 px;
- navigation drawer closed by default inside a lesson.

## 23.2 Desktop Explore

```text
Header
View toolbar
3D stage
Collapsible inspector
Compact legend
```

Do not reserve large empty navigation sidebars.

## 23.3 Mobile lesson

```text
Header + progress
Focused scene, 48–55vh
Teaching sheet
Evidence
Previous / Next
```

Requirements:

- explanation visible without opening a hidden inspector;
- maximum three labels;
- mobile-specific camera framing;
- no horizontal overflow;
- no clipped active route;
- no tiny text.

---

# 24. Code architecture requirements

Adapt to the repository, but create responsibility boundaries equivalent to:

```text
src/renderer/
├── scene/
│   ├── SceneEnvironment.ts
│   ├── StageFoundation.ts
│   ├── SemanticZone.ts
│   └── SceneLayers.ts
├── scene-grammar/
├── visuals/
├── layouts/
├── routes/
├── labels/
├── camera/
├── animation/
├── design/
└── diagnostics/
```

## 24.1 Split entity visuals

Do not keep every visual in one generic factory.

Required dedicated visual classes or modules:

- ClusterFoundationVisual;
- NodeVisual;
- PodVisual;
- ContainerVisual;
- ApiServerVisual;
- EtcdVisual;
- ControllerManagerVisual;
- SchedulerVisual;
- KubeletVisual;
- ContainerRuntimeVisual;
- NamespaceVisual;
- DeploymentVisual;
- ReplicaSetVisual;
- ServiceVisual;
- EndpointSliceVisual;
- ExternalClientVisual;
- DeveloperVisual.

A fallback generic visual is allowed only for unsupported future kinds.

## 24.2 Scene controller

The SceneController orchestrates:

- world/projection application;
- scene grammar;
- visual registry;
- layout;
- route registry;
- labels;
- camera;
- animation;
- render scheduling;
- disposal.

It must not contain all geometry construction.

## 24.3 Layout separation

Use separate layouts:

- OverviewFoundationLayout;
- LogicalOwnershipLayout;
- PlacementRuntimeLayout;
- ControlFlowLayout;
- TrafficLayout;
- StorageLayout.

Do not make one array-index layout place every kind.

## 24.4 Animation separation

Separate:

- route token animation;
- lifecycle animation;
- state transition;
- camera transition;
- layout transition;
- callout;
- selection pulse.

Do not implement every non-path cue as `scale.multiplyScalar(...)`.

Every animation must:

- have an explicit start state;
- have an explicit end state;
- restore state on cancel;
- be deterministic on replay;
- respect reduced motion.

---

# 25. Content-data changes

## 25.1 Scenario is a world model, not a scene dump

`demo-shop.yaml` may contain all entities, but a scene grammar decides which subset is visible.

Do not use scenario entity count as the default scene entity count.

## 25.2 Endpoint data

Add actual synthetic endpoint data:

```yaml
data:
  serviceId: api-object:namespaced:shop:Service:api
  endpoints:
    - id: api-a-endpoint
      addresses: [10.20.0.11]
      targetRef: api-object:namespaced:shop:Pod:api-a
      conditions:
        ready: true
        serving: true
        terminating: false
```

## 25.3 Replica data

ReplicaSet should expose:

```yaml
data:
  desiredReplicas: 3
  currentReplicas: 3
  readyReplicas: 3
```

## 25.4 Container data

Pod runtime data must distinguish Containers:

```yaml
containers:
  - id: runtime-container:shop:api-a:api
    name: api
    state: running
    restartCount: 0
    generation: 1
```

## 25.5 Route definitions

Add authored semantic routes:

```yaml
routes:
  - id: internal-web-to-api
    semantic: application
    hops:
      - from: api-object:namespaced:shop:Pod:web-a
        fromAnchor: network-out
        to: api-object:namespaced:shop:Service:api
        toAnchor: network-in
      - from: api-object:namespaced:shop:Service:api
        fromAnchor: network-out
        to: api-object:namespaced:shop:Pod:api-b
        toAnchor: network-in
    support:
      endpointSliceId: api-object:namespaced:shop:EndpointSlice:api-slice
      selectedEndpointId: api-b-endpoint
```

Use a schema validated by Zod.

---

# 26. First traffic lesson detailed acceptance

The current Service lesson must be rebuilt, not merely assigned a thicker sphere path.

## 26.1 Step 0 — Orient the traffic scene

Show:

- client web Pod;
- api Service;
- api EndpointSlice;
- three api backend Pods;
- Nodes only as subdued context.

No control-plane components.

## 26.2 Step 1 — Stable Service entry

Focus:

- Service;
- name;
- synthetic ClusterIP in panel.

Explain:

- stable logical access point;
- not necessarily a proxy process.

## 26.3 Step 2 — Endpoint inventory

Focus:

- EndpointSlice;
- three endpoint rows;
- ready conditions;
- target Pod links.

No packet animation yet.

## 26.4 Step 3 — Request chooses one backend

Before animation:

- persistent blue route is drawn;
- arrowheads are visible;
- selected endpoint row is highlighted;
- start and end are visible.

During animation:

- 2–3 small request tokens move along the visible route;
- route remains brighter than tokens;
- no token enters the EndpointSlice card.

After animation:

- route remains visible;
- selected backend remains highlighted.

## 26.5 Step 4 — One backend becomes NotReady

State:

- Pod remains visible;
- readiness indicator fails;
- endpoint row changes ready state;
- previous route to that backend fades;
- alternative ready backend route becomes selected.

## 26.6 Step 5 — Service remains stable

Evidence:

```text
Service name       unchanged
ClusterIP          unchanged
Ready endpoints    3 → 2
Selected backend   api-b → api-c
```

Final takeaway:

> Clients use the stable Service while backend membership can change.

---

# 27. Visual acceptance tests

Automated screenshots must not be treated as correct merely because they match a baseline.

Create:

```text
docs/review/
├── CURRENT_STATE_FINDINGS.md
├── FOUNDATION_REBUILD_PROGRESS.md
├── VISUAL_ACCEPTANCE_CHECKLIST.md
├── screenshots/
└── before-after/
```

## 27.1 Required screenshots

Desktop `1440×900`:

- Overview baseline;
- Pod/Container close view;
- Logical ownership;
- Placement;
- Control flow;
- Service traffic before token;
- Service traffic during token;
- Service traffic settled;
- Endpoint NotReady reroute;
- Container restart;
- Pod replacement Pending;
- Pod replacement scheduled;
- Rolling update traffic shift.

Desktop `1280×720`:

- Overview;
- Service traffic;
- control flow.

Mobile `390×844`:

- Overview;
- Pod/Container;
- Service traffic;
- Container restart;
- Pending scheduling.

## 27.2 Screenshot checklist

For every screenshot record:

- primary learning objective;
- visible entities;
- hidden entities;
- primary focus;
- active route;
- label count;
- relation count;
- safe-frame result;
- collision result;
- five-second comprehension result;
- known limitations.

---

# 28. Automated gates

## 28.1 Scene density gate

Fail when:

- visible primary entities exceed the grammar budget;
- label count exceeds the budget;
- more than three entities are focused;
- more than two relation families plus active route are visible;
- guided Overview includes all Deployments, ReplicaSets, Services, EndpointSlices, Pods, and control-plane components simultaneously.

## 28.2 Collision gate

Fail when:

- unrelated primary entity AABBs overlap;
- Pod AABB leaves its Node bay;
- Pod overlaps kubelet/runtime modules;
- label rectangles overlap above threshold;
- label covers focused entity center;
- route intersects unrelated primary entity AABB;
- arrowhead is clipped.

## 28.3 Hierarchy gate

Fail when:

- Container is not spatially inside its Pod;
- scheduled Pod is not spatially inside/on its Node;
- Pending Pod is inside a Node;
- Namespace visually contains Node;
- Deployment/ReplicaSet is placed as a physical parent directly above a Node in Placement view;
- traffic path includes Deployment, ReplicaSet, Namespace, or EndpointSlice as a physical packet hop.

## 28.4 Route gate

Fail when:

- flow token exists without persistent route;
- route width is less than 4 CSS px for an active traffic route;
- no arrowhead/direction marker;
- reduced-motion mode hides the route;
- route disappears immediately after token completion;
- direct navigation produces a different settled route than sequential navigation;
- selected endpoint and route endpoint disagree.

## 28.5 Curriculum gate

Fail release validation when:

- fewer than 12 lessons are marked available after the curriculum milestone;
- a planned placeholder appears as completed;
- lesson source IDs are missing;
- glossary first-use rule fails;
- a lesson has no takeaway;
- a traffic lesson has no static-readable route;
- an available lesson has only narration changes and no meaningful scene/evidence change.

## 28.6 Animation gate

Fail when:

- replay changes object scale permanently;
- cancel leaves stale token, route, label, or focus;
- non-path cue is implemented only as cumulative scaling;
- reduced-motion mode loses information;
- switching lesson retains prior route.

## 28.7 Resource gate

After 20 cycles across views and lessons, resource counts remain bounded:

- geometries;
- materials;
- textures;
- shader programs;
- render targets;
- route handles;
- labels;
- tokens;
- event listeners.

---

# 29. Human visual gates

Automation cannot decide whether the product looks polished.

A human reviewer must mark every item PASS.

## 29.1 Foundation

- [ ] The cluster boundary is clear.
- [ ] Control Plane and Worker Nodes are clear peers.
- [ ] The stage no longer looks like objects dropped on a debug grid.
- [ ] Semantic zones are clear.
- [ ] There are no giant overlapping translucent discs.

## 29.2 Hierarchy

- [ ] Node chassis is visually substantial.
- [ ] Pods visibly occupy Node bays.
- [ ] Containers visibly exist inside Pods.
- [ ] Pending Pods are visibly outside Nodes.
- [ ] Namespace is not mistaken for a physical host.
- [ ] Workload ownership and physical placement are not conflated.

## 29.3 Models

- [ ] API server, etcd, scheduler, and controller manager have distinct silhouettes.
- [ ] Scheduler does not look like a generic cone.
- [ ] Controller manager does not look like a torus knot.
- [ ] Deployment, ReplicaSet, Service, and EndpointSlice are visually distinct.
- [ ] External actors do not look like Pods.
- [ ] The palette is not uniformly green.

## 29.4 Labels

- [ ] No dense label pile.
- [ ] No label covers a primary object.
- [ ] Full UIDs are not floating in world space.
- [ ] Labels remain readable in Chinese, Japanese, and English.
- [ ] Labels are secondary to the scene, not the scene itself.

## 29.5 Routes

- [ ] Application route is visible in a static screenshot.
- [ ] Direction is unmistakable.
- [ ] Active route is thicker than context relations.
- [ ] Token follows the visible route.
- [ ] Route does not pass through unrelated objects.
- [ ] EndpointSlice is shown as support/configuration, not a physical packet processor.
- [ ] Reduced motion remains understandable.

## 29.6 Teaching

- [ ] Each step has one primary idea.
- [ ] Learner knows what changed.
- [ ] Learner knows why.
- [ ] Evidence is visible.
- [ ] Takeaway is explicit.
- [ ] The next lesson follows prerequisite order.
- [ ] The application no longer feels like a raw 3D graph inspector.

Any FAIL blocks the relevant milestone.

---

# 30. Implementation milestones

Implement exactly in this order.

## Milestone 0 — Baseline and protection

Deliver:

- copy current screenshot into `docs/review/before-after/current-overview.png`;
- capture current screenshots for all five available lessons;
- document current visible object counts;
- document current label overlaps;
- document current route behavior;
- keep existing tests passing;
- create progress and checklist files.

Do not approve the current screenshots as future baselines.

Commit:

```text
docs: capture rejected visual baseline and rebuild gates
```

## Milestone 1 — Scene grammar and density policy

Deliver:

- scene grammar interfaces;
- view-specific allowed/hidden kinds;
- density budgets;
- default Explore Overview filter;
- guided lessons no longer inherit the all-object scene;
- deterministic grammar tests.

Commit:

```text
feat: add view-specific scene grammars and density budgets
```

## Milestone 2 — Foundation and semantic islands

Deliver:

- cluster foundation;
- Control Plane island;
- Worker Nodes island;
- unscheduled tray;
- bounded stage;
- background/lighting redesign;
- removal of dominant infinite grid;
- Overview screenshot passing five-second gate.

Commit:

```text
feat: rebuild the cluster from a clear foundation
```

## Milestone 3 — Runtime hierarchy models

Deliver:

- Node chassis;
- Pod bays;
- embedded kubelet;
- embedded container runtime;
- Pod shell;
- Container module;
- Pending placement;
- placement collision tests;
- Pod/Container close-view screenshots.

Commit:

```text
feat: make node pod and container hierarchy explicit
```

## Milestone 4 — Logical object models

Deliver:

- Namespace workspace;
- Deployment blueprint;
- ReplicaSet counters;
- Service portal;
- EndpointSlice endpoint list;
- external actors;
- logical/placement separation.

Commit:

```text
feat: establish distinct logical Kubernetes object visuals
```

## Milestone 5 — Camera, labels, and responsive layout

Deliver:

- safe viewport camera framer;
- orthographic guided camera;
- Explore perspective option;
- label priority and collision manager;
- fixed Teaching/Evidence panel;
- mobile teaching sheet;
- screenshot tests at all required viewports.

Commit:

```text
feat: make teaching scenes readable across viewport sizes
```

## Milestone 6 — Persistent route engine

Deliver:

- wide route renderer;
- route anchors;
- obstacle map;
- route planner;
- arrowheads;
- active route layer;
- token pool;
- request/response support;
- reduced-motion route behavior;
- no-token-without-route validation.

Commit:

```text
feat: replace free-flying tokens with persistent semantic routes
```

## Milestone 7 — Rebuild existing five lessons

Migrate:

- cluster overview;
- Pod and placement;
- manifest to running Pod;
- Service and EndpointSlice;
- Container restart vs Pod replacement.

Each must use:

- correct scene grammar;
- fixed teaching panel;
- evidence;
- takeaway;
- persistent route when relevant;
- new visual models;
- screenshot acceptance.

Commit:

```text
feat: migrate the original lessons to the foundation-first system
```

## Milestone 8 — Expand to 12 complete lessons

Add the missing core lessons described in this directive.

Requirements:

- source-verified;
- three languages;
- glossary order;
- interactive steps;
- scene/evidence changes;
- no placeholders marked available.

Commit:

```text
feat: expand the interactive foundations curriculum to twelve lessons
```

## Milestone 9 — Complete the eight flow stories

Implement the eight mandatory stories.

At minimum, P0 stories 1–4 must be production-quality before moving on.

Commit:

```text
feat: deliver readable control and application flow stories
```

## Milestone 10 — Validation, portfolio polish, and deployment

Deliver:

- all automated gates;
- human checklist;
- bounded memory test;
- before/after page;
- README corrected to exact available lesson/story count;
- real screenshots;
- short demo recording;
- live deployment;
- no exaggerated “complete” claim.

Commit:

```text
test: lock visual teaching and flow acceptance gates
```

---

# 31. Required repository documentation

Create or update:

```text
docs/
├── architecture.md
├── visualization-semantics.md
├── scene-grammars.md
├── flow-story-authoring.md
├── lesson-authoring.md
├── accuracy-policy.md
└── review/
    ├── CURRENT_STATE_FINDINGS.md
    ├── FOUNDATION_REBUILD_PROGRESS.md
    ├── VISUAL_ACCEPTANCE_CHECKLIST.md
    ├── ROUTE_ACCEPTANCE_CHECKLIST.md
    └── before-after/
```

`visualization-semantics.md` must explicitly explain:

- why Namespace and Node use separate projections;
- why a packet does not pass through Deployment/ReplicaSet/EndpointSlice objects;
- how Service is represented as a logical portal;
- how active routes differ from persistent relations;
- that animations are conceptual explanations, not packet captures.

---

# 32. Official factual baseline

Use primary official documentation.

Required reference set:

- Kubernetes Components  
  `https://kubernetes.io/docs/concepts/overview/components/`

- Kubernetes Objects  
  `https://kubernetes.io/docs/concepts/overview/working-with-objects/`

- Pods  
  `https://kubernetes.io/docs/concepts/workloads/pods/`

- Pod lifecycle  
  `https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/`

- Deployments  
  `https://kubernetes.io/docs/concepts/workloads/controllers/deployment/`

- ReplicaSet  
  `https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/`

- Services  
  `https://kubernetes.io/docs/concepts/services-networking/service/`

- EndpointSlices  
  `https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/`

- DNS for Services and Pods  
  `https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/`

- Probes  
  `https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/`

- Horizontal Pod Autoscaling  
  `https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/`

- Persistent Volumes  
  `https://kubernetes.io/docs/concepts/storage/persistent-volumes/`

- Gateway API  
  `https://kubernetes.io/docs/concepts/services-networking/gateway/`

For Three.js wide lines:

- `https://threejs.org/docs/#examples/en/lines/Line2`
- `https://threejs.org/docs/#examples/en/lines/LineMaterial`
- `https://threejs.org/docs/#examples/en/lines/LineGeometry`

Verify dates in course sources when implementation occurs.

---

# 33. Definition of done

This rebuild is done only when all conditions hold.

## Structure

- guided Overview no longer shows every object;
- cluster foundation and semantic islands are clear;
- Node → Pod → Container hierarchy is obvious;
- Namespace and Node remain orthogonal;
- objects no longer overlap or visually merge.

## Visual quality

- no all-green object field;
- no generic primitive placeholder for primary entities;
- no giant debug grid;
- no label pile;
- no world-space full metadata cards;
- clear materials, bevels, shadows, and restrained accents.

## Flow

- persistent route is visible before a token moves;
- token follows the route;
- route remains after motion;
- application and control routes are visibly different;
- static screenshot explains the path;
- at least eight complete flow stories exist.

## Curriculum

- at least 12 complete interactive lessons are available;
- planned lessons are not described as complete;
- prerequisites are coherent;
- all terms are introduced before use;
- all lessons have evidence and takeaway;
- all factual claims have primary sources.

## Engineering

- direct navigation deterministic;
- replay deterministic;
- cancel restores settled state;
- reduced motion preserves meaning;
- resources remain bounded;
- all required automated checks pass;
- human screenshot checklist passes.

---

# 34. Final report format

After implementation, report exactly:

```markdown
# Implemented

## Baseline reviewed
- reference screenshot:
- current main commit:
- original available lesson count:
- original flow-story behavior:

## Milestone commits
- `<hash>` — `<message>`

## Scene architecture
- Overview grammar:
- Logical grammar:
- Placement grammar:
- Control grammar:
- Traffic grammar:
- Storage grammar:

## Foundation and models
- Cluster foundation:
- Control plane:
- Nodes:
- Pods:
- Containers:
- Workload objects:
- Network objects:

## Routes and flow stories
- Persistent route implementation:
- Wide-line implementation:
- Obstacle avoidance:
- Reduced motion:
- Completed stories:
- Static route screenshot paths:

## Curriculum
- Available lessons before:
- Available lessons after:
- New lessons:
- Planned lessons remaining:

## Validation
- `pnpm format:check`:
- `pnpm lint`:
- `pnpm typecheck`:
- `pnpm content:validate`:
- `pnpm test:unit -- --run`:
- `pnpm build`:
- `pnpm test:e2e`:
- 20-cycle resource stress:
- scene density gates:
- collision gates:
- route gates:
- curriculum gates:

## Human visual acceptance
- Foundation checklist:
- Hierarchy checklist:
- Model checklist:
- Label checklist:
- Route checklist:
- Teaching checklist:
- Remaining FAIL items:

## Review artifacts
- desktop screenshots:
- mobile screenshots:
- before/after page:
- demo recording:
- live URL:

## Known limitations
- only concrete unresolved limitations
```

Do not claim completion when any mandatory item is still FAIL.

---

# 35. Start command

Execute this directive.

Do not create another planning-only document.  
Do not solve the screenshot by spreading the same generic green models farther apart.  
Do not solve missing routes by adding more moving balls.  
Do not mark planned lessons as complete.  
Build the foundation, separate the mental models, make hierarchy visible, implement persistent routes, expand the curriculum, validate screenshots, and report actual results.
