# Monitoring boundary

The verified release loads one synthetic `container-restart-golden` scenario at build time. It does not include a cluster provider, Kubernetes client, ServiceAccount, credential form, metrics/logs/traces reader, terminal, backend API, or mutation path.

Explore (Beta) operates only on the compiled in-browser `WorldSnapshot`. Search, filters, selection, locale changes, and camera controls do not send data to a server.

The debug bridge is enabled only for development or localhost test runs. It exposes UI state and aggregate renderer diagnostics; it does not expose credentials or connect to a cluster.
