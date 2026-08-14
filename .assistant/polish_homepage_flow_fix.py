from pathlib import Path

# Keep the ambient-flow hook compatible with lightweight controller mocks used by fallback tests.
path = Path('src/components/SceneViewport.tsx')
text = path.read_text('utf-8')
old = "controllerRef.current?.setAmbientRouteFlow(props.ambientRouteFlow ?? false);"
new = "controllerRef.current?.setAmbientRouteFlow?.(props.ambientRouteFlow ?? false);"
if old not in text:
    raise SystemExit('ambient-route compatibility call not found')
path.write_text(text.replace(old, new, 1), 'utf-8')

# Reserve a real telemetry dock below the 3D stage. The previous pass still allowed the readout to
# overlap the live model by 32–48px depending on viewport size; this makes the separation physical,
# not just visual transparency.
path = Path('src/styles/award/03-showcase.css')
text = path.read_text('utf-8')
old = '  inset: 112px 22px 178px;\n'
new = '  inset: 104px 22px 218px;\n'
if old not in text:
    raise SystemExit('desktop showcase viewport inset not found')
path.write_text(text.replace(old, new, 1), 'utf-8')

path = Path('src/styles/award/05-responsive.css')
text = path.read_text('utf-8')
old = '''    inset: 92px 10px 142px;
    border-radius: 12px;
  }
'''
new = '''    inset: 92px 10px 196px;
    border-radius: 12px;
  }

  .home-showcase .scene-label[data-emphasis='normal'] {
    display: none;
  }

  .home-showcase .scene-route-label {
    max-width: min(46vw, 180px) !important;
    padding: 2px 4px;
    font-size: 8px;
  }
'''
if old not in text:
    raise SystemExit('mobile showcase viewport block not found')
path.write_text(text.replace(old, new, 1), 'utf-8')

# The scene projection can switch to a compact/mobile layout on a 1280px laptop because the hero
# occupies one column. That should not disable mouse/trackpad polish. Gate the effect by the actual
# pointer type instead; touch stays quiet and inexpensive.
path = Path('src/components/HomeShowcase.tsx')
text = path.read_text('utf-8')
old = "    if (reducedMotion || viewportClass === 'mobile') return;\n"
new = "    if (reducedMotion || event.pointerType === 'touch') return;\n"
if old not in text:
    raise SystemExit('pointer capability gate not found')
path.write_text(text.replace(old, new, 1), 'utf-8')

# GitHub's Actions token is intentionally unable to modify workflow files during a self-push.
# Keep docker.yml identical to the branch base here; the connected GitHub client applies the
# notification-hygiene workflow change only after the visual source has passed every check.
Path('.github/workflows/docker.yml').write_text('''name: Container image
on:
  push:
    branches: [main]
    tags: ['v*']
  release:
    types: [published]
permissions:
  contents: read
  packages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        if: startsWith(github.ref, 'refs/tags/') || github.event_name == 'release'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/kubemotion-3d
          tags: |
            type=semver,pattern={{version}}
            type=sha
            type=raw,value=latest,enable=${{ github.event_name == 'release' }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ startsWith(github.ref, 'refs/tags/') || github.event_name == 'release' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          provenance: mode=max
          sbom: true
''', 'utf-8')
