# Accuracy policy

Core Kubernetes facts use official Kubernetes documentation; Gateway API facts use official
Kubernetes or Gateway API documentation. Every source and lesson records a `verifiedAt` date.
Content distinguishes a general Kubernetes mechanism from one possible implementation, especially
for Service data planes and Gateway controllers.

The scene is a conceptual teaching model. Synthetic IDs and timestamps are used, while field
meanings follow Kubernetes API concepts. Control routes simplify watch and update interactions and
are not packet captures. Service data-plane behavior is implementation-dependent. Visual
simplification does not imply literal timing, guaranteed ordering, connection migration, or a
specific proxy implementation.

Corrections should include the lesson and step ID, the claim in question, and an official source.
Update all three locales without changing the underlying fact.

Static checks validate schemas, references, selectors, allowed hosts, term order, flow-path
semantics, translations, sensitive expressions, and the final lesson-specific accuracy invariants.
They cannot prove every prose statement is true, current, or complete. Human review remains
mandatory.

The verified Pod lifecycle lesson additionally checks its exact compiled history. A Container
process exit keeps the Pod in phase `Running` but changes `ContainersReady` and `Ready` to false;
ReplicaSet `.status.readyReplicas` falls from 3 to 2 while `.status.replicas` stays 3. Kubelet then
starts a replacement runtime Container locally on the same Node: the Pod UID and Node stay the
same, `containerID` changes, `restartCount` becomes 1, `lastState` records the termination, and
readiness returns. Pod replacement removes the old identity, creates a new Pending and unscheduled
Pod, binds it separately, and only then lets kubelet create its first running Container.

The verified Service lesson distinguishes two completed requests. Request A reaches one Ready
backend. After that endpoint becomes `ready=false`, `serving=false`, and `terminating=false`, the
EndpointSlice row remains present but ordinary Service traffic no longer selects it. A later Request
B enters the unchanged Service and selects another Ready backend; the lesson makes no claim that an
in-flight request or established connection is migrated.
