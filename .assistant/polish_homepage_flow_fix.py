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
old = '    inset: 92px 10px 142px;\n'
new = '    inset: 92px 10px 196px;\n'
if old not in text:
    raise SystemExit('mobile showcase viewport inset not found')
path.write_text(text.replace(old, new, 1), 'utf-8')
