# Monitoring boundary

Release 0.1 implements only `StaticScenarioProvider`, which returns the synthetic `demo-shop` snapshot. It does not monitor a cluster.

A future topology snapshot and telemetry streams would need separate layers. Any real-cluster design must independently address read-only RBAC, data minimization, redaction, sampling frequency, caching, staleness, and failure policy. Kubernetes API topology, metrics, logs, and traces must not be collapsed into one provider.

The UI and renderer must never consume a cluster credential directly. This document defines boundaries only; it does not promise a technology choice or implementation date.
