# Homepage Kubernetes Playground

The homepage keeps the real `SceneViewport` visible as a persistent, interactive product demo rather than a transient intro.

## Scenarios

- **Overview** — manifest → API → reconciliation → scheduling → kubelet/runtime → Ready
- **Request** — client → stable Service → Ready backend
- **Kill container** — Container exit → kubelet restart inside the same Pod
- **Delete Pod** — API deletion → controller replacement → scheduling → runtime startup
- **Scale +** — HPA desired replica change → controller → Scheduler → kubelet → expanded traffic

Every scenario is compiled from the same verified lesson/Flow Story sources used by the full teaching experience. The homepage does not maintain a separate decorative Kubernetes model.

Reduced-motion mode disables autoplay and advances the scenario one verified beat at a time.

## Final validation

The persistent playground is covered by unit and real-browser regression tests at the repository's desktop, laptop, and mobile Playwright viewports. The browser matrix also exercises the local kubelet restart beat, reduced-motion stepping, scenario deep links, uncaught page errors, and horizontal overflow.
