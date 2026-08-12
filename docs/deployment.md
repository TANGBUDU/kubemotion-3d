# Deployment

`pnpm build` creates a static `dist/` directory. HashRouter and a relative Vite base allow hosting at a subpath. The canonical deployment is [GitHub Pages](https://tangbudu.github.io/kubemotion-3d/), published from `main` by `.github/workflows/pages.yml`.

The Dockerfile uses digest-pinned Node and nginx-unprivileged images. The final container listens on 8080 as UID 101 and exposes `/healthz`. The bundled nginx policy blocks outbound browser connections through CSP.

The Helm chart deploys only the static site. It disables ServiceAccount token mounting, runs non-root with a read-only root filesystem, drops all capabilities, uses RuntimeDefault seccomp, mounts writable temporary directories, defines requests/limits, and configures readiness/liveness probes. It creates no RBAC or ServiceAccount.
