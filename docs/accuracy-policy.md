# Accuracy policy

Core Kubernetes facts use official Kubernetes documentation; Gateway API facts use official Kubernetes or Gateway API documentation. Every source and lesson records a `verifiedAt` date. Content should distinguish a general Kubernetes mechanism from one possible implementation, especially for Service data planes and Gateway controllers.

Visual simplification does not mean literal packet capture, timing, or guaranteed ordering. Control loops continuously observe and update API state even when a lesson presents a sequence for teaching.

Corrections should include the lesson and step ID, the claim in question, and an official source. Update all three locales without changing the underlying fact.

Static checks validate schemas, references, selectors, allowed hosts, term order, flow-path semantics, translations, and a small set of sensitive or misleading expressions. They cannot prove prose is true, current, or complete. Human review remains mandatory.

The verified golden lesson additionally checks its exact compiled history: one Pod and UID survive a child Container restart; replacement removes that identity; the new Pod first exists Pending and unscheduled, then runs on `worker-c`; and ReplicaSet desired/current/ready moves through `3/3/3 → 3/2/2 → 3/3/2 → 3/3/3`. These checks are derived from immutable snapshots and deterministic diffs.
