from pathlib import Path

path = Path('src/components/SceneViewport.tsx')
text = path.read_text('utf-8')
old = "controllerRef.current?.setAmbientRouteFlow(props.ambientRouteFlow ?? false);"
new = "controllerRef.current?.setAmbientRouteFlow?.(props.ambientRouteFlow ?? false);"
if old not in text:
    raise SystemExit('ambient-route compatibility call not found')
path.write_text(text.replace(old, new, 1), 'utf-8')
