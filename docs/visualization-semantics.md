# Visualization semantics

## Golden-lesson objects

- **Node:** a dark rack/platform with a visible name and four Pod slots.
- **Pod:** a translucent shell. Its child Container is attached inside the shell; focused Pods expose UID, Node, phase, and aggregate restart metadata.
- **Container:** a separately addressable runtime block. Failure collapses and marks the child without replacing the Pod shell; restart changes its instance generation and restart count.
- **ReplicaSet:** a purple counter card with desired/current/ready values.
- **kubelet:** a blue Node-local agent with heartbeat bars.
- **Controller manager:** a purple reconciliation knot.
- **Scheduler:** a cyan assignment marker.
- **Pending lane:** a dashed amber area outside Node racks. An unscheduled Pod appears there before a scheduling relation exists.

Generic fallback is disabled for these entities.

## Relations

Relation semantics differ by line shape, routing, width, dashes, arrowheads, and color—not color alone.

- ownership: purple curved arrow;
- composition: short pale dashed link;
- placement: blue orthogonal dashed arrow;
- control observation: purple dashed curve;
- selection and endpoint membership: cyan/green routed arrows;
- data and DNS flow: distinct solid/dashed directed paths;
- storage: green orthogonal link;
- configuration and scope: lower-emphasis routed links.

Relations are structural facts in the snapshot. Transition tokens are temporary explanations and do not create new factual edges.

## Labels and callouts

Authored `labelMode` is respected. DOM labels are prioritized by selection, focus, entity kind, and camera distance, then collision-filtered every render. Selected and focused entities win over ordinary or dimmed labels. Step callouts are anchored to entity handles and removed when the step changes.

## Transition tokens

- blue: application data;
- cyan: DNS query;
- purple: Kubernetes API request;
- purple reconciliation pulse: controller activity, not a network packet;
- cyan scheduler token: assignment;
- lifecycle scale/fade: Container failure, restart, or entity entry/exit.

Animations explain responsibility and causality. They are not packet captures, literal timing traces, or a claim that every implementation uses the same data plane.
