# Monitoring boundary

The verified release loads two synthetic scenarios at build time:
`container-restart-golden` and `service-routes-to-pods`. It does not include a cluster provider,
Kubernetes client, ServiceAccount, credential form, metrics/logs/traces reader, terminal, backend
API, or mutation path.

Explore (Beta) operates only on the compiled in-browser `WorldSnapshot`. Search, filters, selection, locale changes, and camera controls do not send data to a server.

The debug bridge is enabled only for development or localhost test runs. It exposes UI state and aggregate renderer diagnostics; it does not expose credentials or connect to a cluster.
