# Cloud Strata 3D handoff workspace

This directory is an isolated workspace for the AWS 3D architecture-builder prototype. It lives on the temporary branch `agent/cloud-strata-3d-handoff` so experiments do not affect KubeMotion `main`.

## Run

The current prototype is self-contained:

```bash
cd cloud-strata-3d
python -m http.server 8000
```

Then open `http://localhost:8000`.

You can also open `index.html` directly in a browser.

## Editing with Claude

Point Claude/Claude Code at this repository and check out:

```bash
git checkout agent/cloud-strata-3d-handoff
cd cloud-strata-3d
```

Ask it to read `CLAUDE.md` before making changes. Keep all Cloud Strata changes inside this directory unless explicitly requested otherwise.

## Current direction

3D must encode containment and hierarchy, not merely make a flat architecture diagram look isometric. The current target hierarchy is:

`AWS Account → Region → VPC → Availability Zone → Subnet → Service`

See `CLAUDE.md` for the design constraints and acceptance criteria.
