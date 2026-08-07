# Visualization semantics

## Object shapes

- Cluster: low boundary platform, not a nesting hierarchy.
- Control-plane runtime: raised octagonal components.
- Node: server-rack platform with Pod placement slots.
- Namespace: translucent logical plane; it never contains Nodes.
- Pod: capsule; containers are conceptually inside its shared boundary.
- Deployment and ReplicaSet: control cards, never traffic processes.
- Service: stable virtual portal; EndpointSlice: backend list card.
- kubelet and container runtime: separate runtime cylinders.

## Relations

Ownership, logical scope, placement, selection, configuration, storage, and control observation use distinct semantic colors and dashed relation lines. Relations are structural; the graph contains no static `data-flow` relation.

## Flow tokens

- Blue sphere on a solid path: application data.
- Cyan diamond-style cue: DNS query.
- Purple document-style cue: Kubernetes API request.
- Orange pulse: reconciliation, not a network packet.
- Shape/status change: lifecycle.
- Green thick link: storage binding or mount.

Configuration objects such as Deployment, ReplicaSet, Gateway, and HTTPRoute are never inserted into a business packet path. Simplified motion shows responsibility and causality; it is not a packet capture or vendor-specific implementation trace.
