from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    text = target.read_text('utf-8')
    if old not in text:
        raise SystemExit(f'Missing expected fragment for {label}: {path}')
    target.write_text(text.replace(old, new, 1), 'utf-8')


def append_once(path: str, marker: str, addition: str, label: str) -> None:
    target = Path(path)
    text = target.read_text('utf-8')
    if addition.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f'Missing append marker for {label}: {path}')
    target.write_text(text.replace(marker, marker + addition, 1), 'utf-8')


# ---------------------------------------------------------------------------
# 1. Make active teaching routes keep a low-cost ambient flow while the
# homepage showcase is visible. The controller uses a 24fps timer rather than
# keeping the entire Three.js render loop hot at 60fps.
# ---------------------------------------------------------------------------
replace_once(
    'src/components/SceneViewport.tsx',
    "  reducedMotion: boolean;\n  cameraResetId?: number | undefined;\n",
    "  reducedMotion: boolean;\n  ambientRouteFlow?: boolean | undefined;\n  cameraResetId?: number | undefined;\n",
    'SceneViewport ambient route prop',
)
replace_once(
    'src/components/SceneViewport.tsx',
    "  useEffect(() => {\n    controllerRef.current?.setReducedMotion(props.reducedMotion);\n  }, [attempt, props.reducedMotion]);\n",
    "  useEffect(() => {\n    controllerRef.current?.setReducedMotion(props.reducedMotion);\n  }, [attempt, props.reducedMotion]);\n  useEffect(() => {\n    controllerRef.current?.setAmbientRouteFlow(props.ambientRouteFlow ?? false);\n  }, [attempt, props.ambientRouteFlow]);\n",
    'SceneViewport ambient route effect',
)

replace_once(
    'src/renderer/relations/RouteHandle.ts',
    "  public sample(progress: number, target = new THREE.Vector3()): THREE.Vector3 {\n",
    "  public setLoopFlowProgress(progress: number): void {\n    this.assertUsable();\n    if (this.reducedMotion) {\n      this.clearFlowTokens();\n      return;\n    }\n    this.root.visible = true;\n    this.line.setVisible(true);\n    for (const arrow of this.arrows) arrow.setVisible(true);\n    for (const marker of this.markers) marker.setVisible(true);\n    this.flowDirection = 'forward';\n    this.root.userData.flowDirection = 'forward';\n    this.root.userData.flowPhase = this.currentRoute.flowPhase ?? 'request';\n    this.ensureFlowTokens();\n    const phase = ((progress % 1) + 1) % 1;\n    const spacing = 1 / Math.max(1, this.tokens.length);\n    this.tokens.forEach((token, index) => {\n      const tokenProgress = (phase + index * spacing) % 1;\n      token.setVisible(true);\n      token.setProgress(this.currentPlan.points, tokenProgress, 'forward');\n    });\n  }\n\n  public sample(progress: number, target = new THREE.Vector3()): THREE.Vector3 {\n",
    'RouteHandle looping flow tokens',
)

replace_once(
    'src/renderer/relations/RelationLayer.ts',
    "  public setResolution(width: number, height: number, pixelRatio = 1): void {\n",
    "  public setLoopFlowProgress(progress: number): void {\n    this.assertUsable();\n    if (this.reducedMotion) return;\n    for (const handle of this.handles.values()) handle.setLoopFlowProgress(progress);\n  }\n\n  public setResolution(width: number, height: number, pixelRatio = 1): void {\n",
    'RelationLayer looping flow',
)

replace_once(
    'src/renderer/SceneController.ts',
    "  private reducedMotion = false;\n  private lastRenderTime = 0;\n",
    "  private reducedMotion = false;\n  private ambientRouteFlow = false;\n  private ambientRouteFlowTimer: number | undefined;\n  private ambientRouteFlowProgress = 0;\n  private ambientRouteFlowLastTime = 0;\n  private lastRenderTime = 0;\n",
    'SceneController ambient flow fields',
)
replace_once(
    'src/renderer/SceneController.ts',
    "  public setOnSelect(callback: (id?: EntityId | undefined) => void): void {\n",
    "  private startAmbientRouteFlowTimer(): void {\n    if (this.ambientRouteFlowTimer !== undefined || this.destroyed || this.reducedMotion) return;\n    this.ambientRouteFlowLastTime = performance.now();\n    this.ambientRouteFlowTimer = window.setInterval(() => {\n      if (\n        this.destroyed ||\n        !this.ambientRouteFlow ||\n        this.reducedMotion ||\n        this.animations.activeCount > 0 ||\n        this.activeRoutes.size === 0\n      ) {\n        this.ambientRouteFlowLastTime = performance.now();\n        return;\n      }\n      const now = performance.now();\n      const elapsed = Math.min(120, Math.max(0, now - this.ambientRouteFlowLastTime));\n      this.ambientRouteFlowLastTime = now;\n      this.ambientRouteFlowProgress = (this.ambientRouteFlowProgress + elapsed * 0.00019) % 1;\n      this.activeRoutes.advanceDash(elapsed * 0.00078);\n      this.activeRoutes.setLoopFlowProgress(this.ambientRouteFlowProgress);\n      this.scheduler.markDirty();\n    }, 42);\n  }\n\n  private stopAmbientRouteFlowTimer(): void {\n    if (this.ambientRouteFlowTimer === undefined) return;\n    window.clearInterval(this.ambientRouteFlowTimer);\n    this.ambientRouteFlowTimer = undefined;\n  }\n\n  public setAmbientRouteFlow(enabled: boolean): void {\n    if (this.ambientRouteFlow === enabled) {\n      if (enabled && !this.reducedMotion) this.startAmbientRouteFlowTimer();\n      return;\n    }\n    this.ambientRouteFlow = enabled;\n    if (enabled && !this.reducedMotion) this.startAmbientRouteFlowTimer();\n    else this.stopAmbientRouteFlowTimer();\n    this.scheduler.markDirty();\n  }\n\n  public setOnSelect(callback: (id?: EntityId | undefined) => void): void {\n",
    'SceneController ambient flow controls',
)
replace_once(
    'src/renderer/SceneController.ts',
    "    this.reducedMotion = reducedMotion;\n    this.activeRoutes.setReducedMotion(reducedMotion);\n    if (reducedMotion && this.cameraTransition) this.finishCameraTransition();\n",
    "    this.reducedMotion = reducedMotion;\n    this.activeRoutes.setReducedMotion(reducedMotion);\n    if (reducedMotion) this.stopAmbientRouteFlowTimer();\n    else if (this.ambientRouteFlow) this.startAmbientRouteFlowTimer();\n    if (reducedMotion && this.cameraTransition) this.finishCameraTransition();\n",
    'SceneController reduced-motion ambient flow gate',
)
replace_once(
    'src/renderer/SceneController.ts',
    "    this.cancelCameraTransition(false);\n    this.animations.destroy();\n",
    "    this.cancelCameraTransition(false);\n    this.stopAmbientRouteFlowTimer();\n    this.animations.destroy();\n",
    'SceneController ambient timer disposal',
)

# ---------------------------------------------------------------------------
# 2. Homepage pointer interaction: coalesce pointer work into one rAF, move only
# CSS custom properties, and stop entirely on mobile/reduced-motion.
# ---------------------------------------------------------------------------
replace_once(
    'src/components/HomeShowcase.tsx',
    "  const hostRef = useRef<HTMLElement>(null);\n  const frameRef = useRef<HTMLDivElement>(null);\n",
    "  const hostRef = useRef<HTMLElement>(null);\n  const frameRef = useRef<HTMLDivElement>(null);\n  const pointerFrameRef = useRef<number | undefined>(undefined);\n  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | undefined>(undefined);\n",
    'HomeShowcase pointer refs',
)
replace_once(
    'src/components/HomeShowcase.tsx',
    "  useEffect(() => {\n    const update = () => setPageVisible(document.visibilityState !== 'hidden');\n    document.addEventListener('visibilitychange', update);\n    return () => document.removeEventListener('visibilitychange', update);\n  }, []);\n",
    "  useEffect(() => {\n    const update = () => setPageVisible(document.visibilityState !== 'hidden');\n    document.addEventListener('visibilitychange', update);\n    return () => document.removeEventListener('visibilitychange', update);\n  }, []);\n\n  useEffect(\n    () => () => {\n      if (pointerFrameRef.current !== undefined) cancelAnimationFrame(pointerFrameRef.current);\n    },\n    [],\n  );\n",
    'HomeShowcase pointer cleanup',
)
old_pointer = """  const updateTilt = (event: ReactPointerEvent<HTMLElement>): void => {
    if (reducedMotion || viewportClass === 'mobile') return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    frame.style.setProperty('--showcase-tilt-x', `${(0.5 - y) * 2.6}deg`);
    frame.style.setProperty('--showcase-tilt-y', `${(x - 0.5) * 3.4}deg`);
    frame.style.setProperty('--showcase-light-x', `${x * 100}%`);
    frame.style.setProperty('--showcase-light-y', `${y * 100}%`);
  };

  const resetTilt = (): void => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--showcase-tilt-x', '0deg');
    frame.style.setProperty('--showcase-tilt-y', '0deg');
    frame.style.setProperty('--showcase-light-x', '64%');
    frame.style.setProperty('--showcase-light-y', '36%');
  };
"""
new_pointer = """  const updateTilt = (event: ReactPointerEvent<HTMLElement>): void => {
    if (reducedMotion || viewportClass === 'mobile') return;
    pendingPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (pointerFrameRef.current !== undefined) return;
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = undefined;
      const frame = frameRef.current;
      const pointer = pendingPointerRef.current;
      if (!frame || !pointer) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (pointer.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (pointer.clientY - rect.top) / rect.height));
      const offsetX = x - 0.5;
      const offsetY = y - 0.5;
      frame.style.setProperty('--showcase-tilt-x', `${-offsetY * 2.1}deg`);
      frame.style.setProperty('--showcase-tilt-y', `${offsetX * 2.8}deg`);
      frame.style.setProperty('--showcase-light-x', `${x * 100}%`);
      frame.style.setProperty('--showcase-light-y', `${y * 100}%`);
      frame.style.setProperty('--showcase-pointer-x', `${x * 100}%`);
      frame.style.setProperty('--showcase-pointer-y', `${y * 100}%`);
      frame.style.setProperty('--showcase-grid-x', `${offsetX * 5}px`);
      frame.style.setProperty('--showcase-grid-y', `${offsetY * 4}px`);
      frame.style.setProperty('--showcase-scan-x', `${offsetX * -3}px`);
      frame.style.setProperty('--showcase-scan-y', `${offsetY * -2}px`);
      frame.style.setProperty('--showcase-pointer-active', '1');
    });
  };

  const resetTilt = (): void => {
    if (pointerFrameRef.current !== undefined) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = undefined;
    }
    pendingPointerRef.current = undefined;
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--showcase-tilt-x', '0deg');
    frame.style.setProperty('--showcase-tilt-y', '0deg');
    frame.style.setProperty('--showcase-light-x', '64%');
    frame.style.setProperty('--showcase-light-y', '36%');
    frame.style.setProperty('--showcase-grid-x', '0px');
    frame.style.setProperty('--showcase-grid-y', '0px');
    frame.style.setProperty('--showcase-scan-x', '0px');
    frame.style.setProperty('--showcase-scan-y', '0px');
    frame.style.setProperty('--showcase-pointer-active', '0');
  };
"""
replace_once('src/components/HomeShowcase.tsx', old_pointer, new_pointer, 'HomeShowcase rAF pointer effect')
replace_once(
    'src/components/HomeShowcase.tsx',
    "            locale={locale}\n            reducedMotion={reducedMotion}\n            cameraMode={viewportClass === 'mobile' ? 'orthographic' : 'perspective'}\n",
    "            locale={locale}\n            reducedMotion={reducedMotion}\n            ambientRouteFlow={inView && pageVisible}\n            cameraMode={viewportClass === 'mobile' ? 'orthographic' : 'perspective'}\n",
    'HomeShowcase ambient route flow opt-in',
)

# ---------------------------------------------------------------------------
# 3. Visual polish: reserve a clean viewport between the top controls and the
# lower telemetry dock; compact the readout; tone down non-focused labels; add
# a pointer light and two low-amplitude parallax layers.
# ---------------------------------------------------------------------------
replace_once(
    'src/styles/award/03-showcase.css',
    "  --showcase-light-x: 64%;\n  --showcase-light-y: 36%;\n",
    "  --showcase-light-x: 64%;\n  --showcase-light-y: 36%;\n  --showcase-pointer-x: 64%;\n  --showcase-pointer-y: 36%;\n  --showcase-pointer-active: 0;\n  --showcase-grid-x: 0px;\n  --showcase-grid-y: 0px;\n  --showcase-scan-x: 0px;\n  --showcase-scan-y: 0px;\n",
    'showcase pointer variables',
)
replace_once(
    'src/styles/award/03-showcase.css',
    ".home-showcase:hover .home-showcase__frame {\n",
    ".home-showcase__frame::before {\n  content: '';\n  position: absolute;\n  z-index: 5;\n  inset: 0;\n  pointer-events: none;\n  opacity: calc(var(--showcase-pointer-active) * 0.72);\n  background: radial-gradient(\n    circle 190px at var(--showcase-pointer-x) var(--showcase-pointer-y),\n    rgb(115 220 255 / 16%),\n    rgb(114 139 255 / 7%) 38%,\n    transparent 72%\n  );\n  mix-blend-mode: screen;\n  transition: opacity 260ms ease;\n}\n\n.home-showcase:hover .home-showcase__frame {\n",
    'showcase pointer aura',
)
replace_once(
    'src/styles/award/03-showcase.css',
    ".home-showcase__viewport {\n  transform: translateZ(0);\n}\n",
    ".home-showcase__viewport {\n  inset: 112px 22px 178px;\n  overflow: hidden;\n  border: 1px solid rgb(115 220 255 / 8%);\n  border-radius: 16px;\n  background: rgb(3 10 18 / 24%);\n  transform: translateZ(0);\n}\n",
    'clean showcase viewport band',
)
replace_once(
    'src/styles/award/03-showcase.css',
    "  background-size: 54px 54px;\n  mask-image: linear-gradient(90deg, #000, transparent 34%, transparent 68%, #000);\n",
    "  background-size: 54px 54px;\n  mask-image: linear-gradient(90deg, #000, transparent 34%, transparent 68%, #000);\n  transform: translate3d(var(--showcase-grid-x), var(--showcase-grid-y), 0) scale(1.018);\n  transition: transform 180ms var(--award-ease);\n  will-change: transform;\n",
    'grid parallax',
)
replace_once(
    'src/styles/award/03-showcase.css',
    "  background: repeating-linear-gradient(0deg, transparent 0 5px, rgb(126 218 255 / 4%) 5px 6px);\n}\n",
    "  background: repeating-linear-gradient(0deg, transparent 0 5px, rgb(126 218 255 / 4%) 5px 6px);\n  transform: translate3d(var(--showcase-scan-x), var(--showcase-scan-y), 0);\n  transition: transform 180ms var(--award-ease);\n  will-change: transform;\n}\n",
    'scan parallax',
)
replace_once(
    'src/styles/award/03-showcase.css',
    "  top: 86px;\n  right: 25px;\n  bottom: 150px;\n",
    "  top: 122px;\n  right: 25px;\n  bottom: 184px;\n",
    'axis kept inside model zone',
)
append_once(
    'src/styles/award/03-showcase.css',
    ".showcase-controls button:hover {\n  border-color: var(--award-cyan);\n  background: rgb(35 96 128 / 76%);\n  transform: translateY(-2px);\n}\n",
    "\n.home-showcase .scene-label {\n  transition: opacity 180ms linear, border-color 180ms linear, background-color 180ms linear;\n}\n\n.home-showcase .scene-label[data-emphasis='normal'] {\n  opacity: 0.58;\n  border-color: rgb(94 182 255 / 24%);\n  background: rgb(5 15 26 / 68%);\n}\n\n.home-showcase .scene-label[data-emphasis='focused'],\n.home-showcase .scene-route-label {\n  opacity: 0.9;\n}\n\n@media (pointer: coarse) {\n  .home-showcase__frame::before {\n    display: none;\n  }\n}\n",
    'homepage scene label quieting',
)

# Replace the large floating readout with a compact telemetry dock that lives below the model zone.
replace_once(
    'src/styles/award/06-playground.css',
    ".showcase-readout {\n  bottom: 142px;\n}\n",
    ".showcase-readout {\n  right: auto;\n  bottom: 104px;\n  left: 28px;\n  width: min(46%, 410px);\n  min-height: 58px;\n  padding: 10px 13px 9px;\n  border: 1px solid rgb(115 220 255 / 14%);\n  border-left: 2px solid var(--award-cyan);\n  border-radius: 10px;\n  background: linear-gradient(110deg, rgb(4 14 24 / 88%), rgb(7 23 37 / 70%));\n  box-shadow: inset 0 1px rgb(255 255 255 / 3%);\n  backdrop-filter: blur(8px);\n}\n",
    'compact telemetry readout',
)
replace_once(
    'src/styles/award/06-playground.css',
    "  margin: 7px 0 5px;\n  color: #f3fbff;\n  font-size: clamp(22px, 2.1vw, 34px);\n",
    "  margin: 4px 0 3px;\n  color: #f3fbff;\n  font-size: clamp(17px, 1.45vw, 22px);\n",
    'smaller telemetry title',
)
replace_once(
    'src/styles/award/06-playground.css',
    ".showcase-readout em {\n  display: block;\n  max-width: 58ch;\n  margin: 8px 0 9px;\n  color: rgb(177 207 228 / 58%);\n  font-size: 10px;\n  font-style: normal;\n  line-height: 1.45;\n}\n",
    ".showcase-readout em {\n  display: none;\n}\n\n.showcase-readout p {\n  margin-bottom: 4px;\n  overflow: hidden;\n  color: rgb(205 229 243 / 62%);\n  font-size: 10px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n",
    'compact telemetry copy',
)
replace_once(
    'src/styles/award/06-playground.css',
    "  .showcase-readout {\n    bottom: 126px;\n  }\n",
    "  .showcase-readout {\n    right: 15px;\n    bottom: 92px;\n    left: 15px;\n    width: auto;\n    min-height: 52px;\n    padding: 8px 10px 7px;\n  }\n",
    'mobile telemetry dock',
)
replace_once(
    'src/styles/award/06-playground.css',
    "    font-size: clamp(18px, 5.3vw, 26px);\n",
    "    font-size: clamp(15px, 4.5vw, 19px);\n",
    'mobile telemetry title',
)

replace_once(
    'src/styles/award/05-responsive.css',
    "  .home-showcase__frame {\n    min-height: min(58svh, 520px);\n    border-radius: 20px;\n  }\n",
    "  .home-showcase__frame {\n    min-height: min(64svh, 560px);\n    border-radius: 20px;\n  }\n\n  .home-showcase__viewport {\n    inset: 92px 10px 142px;\n    border-radius: 12px;\n  }\n",
    'mobile model viewport',
)
append_once(
    'src/styles/award/05-responsive.css',
    "@media (prefers-reduced-motion: reduce) {\n",
    "",
    'noop',
)
# Add reduced-motion overrides before the closing rule by replacing a stable fragment.
replace_once(
    'src/styles/award/05-responsive.css',
    "  .home-showcase__frame,\n  .value-grid article,\n",
    "  .home-showcase__frame::before {\n    display: none !important;\n  }\n\n  .home-showcase__grid,\n  .home-showcase__scan {\n    transform: none !important;\n    transition: none !important;\n  }\n\n  .home-showcase__frame,\n  .value-grid article,\n",
    'reduced-motion pointer polish',
)

# ---------------------------------------------------------------------------
# 4. Browser regression: verify ambient flow survives after the authored cue,
# overlays do not overlap the 3D viewport, and pointer work remains CSS-only.
# ---------------------------------------------------------------------------
e2e = Path('tests/e2e/homePlayground.spec.ts')
text = e2e.read_text('utf-8')
needle = """  await expect(scenario('Overview')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Manifest to running Pod', { exact: true })).toBeVisible();

"""
addition = """  await showcase.locator('.showcase-timeline button').first().click({ force: true });
  await expect(showcase).toHaveAttribute('data-beat-index', '0');
  await expect
    .poll(async () =>
      page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()?.activeAnimations ?? -1),
    )
    .toBe(0);
  await expect
    .poll(async () =>
      page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()?.flowTokens ?? 0),
    )
    .toBeGreaterThan(0);

  const viewportBox = await showcase.locator('.home-showcase__viewport').boundingBox();
  const readoutBox = await showcase.locator('.showcase-readout').boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(readoutBox).not.toBeNull();
  if (viewportBox && readoutBox) {
    expect(readoutBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height - 1);
  }

  const frame = showcase.locator('.home-showcase__frame');
  const frameBox = await frame.boundingBox();
  if (frameBox && testInfo.project.name.includes('desktop')) {
    await page.mouse.move(frameBox.x + frameBox.width * 0.72, frameBox.y + frameBox.height * 0.34);
    await expect
      .poll(() => frame.evaluate((element) => element.style.getPropertyValue('--showcase-pointer-active')))
      .toBe('1');
  }

"""
if addition.strip() not in text:
    if needle not in text:
        raise SystemExit('Missing E2E insertion point')
    text = text.replace(needle, needle + addition, 1)
e2e.write_text(text, 'utf-8')

# ---------------------------------------------------------------------------
# 5. Notification / CI hygiene. Docker publication should not run on every UI
# push; it only needs releases/tags/manual dispatch. Obsolete assistant bundle
# workflow and scratch files are removed only after this patch validates.
# ---------------------------------------------------------------------------
replace_once(
    '.github/workflows/docker.yml',
    "on:\n  push:\n    branches: [main]\n    tags: ['v*']\n  release:\n    types: [published]\n",
    "on:\n  push:\n    tags: ['v*']\n  release:\n    types: [published]\n  workflow_dispatch:\n",
    'Docker workflow notification reduction',
)
