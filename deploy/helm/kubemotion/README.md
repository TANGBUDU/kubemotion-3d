# KubeMotion Helm chart

This chart deploys only the static KubeMotion site. It creates no ServiceAccount, RBAC, cluster-wide permission, live cluster connector, or telemetry collector.

```sh
helm upgrade --install kubemotion deploy/helm/kubemotion
```
