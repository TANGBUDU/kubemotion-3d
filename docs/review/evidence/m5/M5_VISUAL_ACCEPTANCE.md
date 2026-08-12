# M5 responsive visual acceptance

Manifest: [`m5-responsive-visual-manifest.json`](./m5-responsive-visual-manifest.json)

## Result

**PASS.** All 15 formal captures pass the automated gate and the human review. The matrix covers
five teaching objectives at 1440×900, 1280×720, and 390×844 while rotating English, Japanese, and
Simplified Chinese through every objective and viewport class.

The former M2, M3, and M4 mobile-risk records remain historical evidence. Their responsive risks
are closed by this M5 matrix; they are not silently rewritten into passing baselines.

## Automated gate summary

| Gate                       | Result                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Mobile visible labels      | PASS — entity, layout, route, and callout labels share one total budget; every 390×844 capture has exactly 3 visible labels      |
| Label collision and bounds | PASS — 0 label/callout overlapping pairs, 0 labels outside the render host, 0 labels outside the camera safe rectangle           |
| Mixed-language layout      | PASS — EN, JA, and zh-CN retain the same scene geometry and stay within the same label budgets                                   |
| Mobile lesson composition  | PASS — each lesson scene is 49.4vh; “What changed” is fully inside the sheet and unobscured by completion UI                     |
| Text legibility            | PASS — measured scene, route, badge, caption, and legend text is at least 10 CSS px                                              |
| Horizontal overflow        | PASS — 0 CSS px at all three required widths                                                                                     |
| Safe viewport              | PASS — measured overlay exclusions match renderer diagnostics and never overlap the accepted safe rectangle                      |
| Camera modes               | PASS — Guided lessons remain orthographic; Explore proves both modes, deterministic reset, and 0 active transitions at capture   |
| Overview framing           | PASS — subjects fill 48–97% of the safe frame; complete foundations stay inside the UI-free content rectangle with a 3 px buffer |
| Persistent routes          | PASS — Service and restart captures retain wide-line geometry, arrowheads, and numbered route markers after animation settlement |
| Runtime placement          | PASS — scheduled Pods remain in bays, Containers remain in Pods, and the Pending Pod stays outside every Node                    |

## Human five-second review

| Objective          | 1440×900                                                                           | 1280×720                                                          | 390×844                                                                                            | Human result |
| ------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| Overview           | Foundation, control plane, workers, and transit lane are separable                 | Same landmarks remain readable with the compact toolbar           | Two-row view selector and three labels leave the whole foundation visible                          | PASS         |
| Pod / Container    | Focused Pod, contained Container slot, Node bay, and unscheduled tray are distinct | Low-distortion perspective keeps containment obvious              | Focused runtime fills the usable scene instead of inheriting the desktop overview scale            | PASS         |
| Service traffic    | Client → stable Service → selected Ready Pod is statically traceable               | Route, endpoint evidence, and teaching panel remain simultaneous  | Wide cyan route, arrow, selected backend, legend, and teaching explanation all remain visible      | PASS         |
| Container restart  | Same-Pod focus, local restart route, and evidence panel agree                      | Focused Pod and local route remain legible beside the fixed panel | Three-label scene and expanded sheet make the local restart fact readable without opening a drawer | PASS         |
| Pending scheduling | Pending Pod is isolated in the transit lane and outside Nodes                      | Pending identity and evidence remain visible together             | `UNSCHEDULED / TRANSIT`, Pending Pod, worker context, and explanation fit without overflow         | PASS         |

## Reviewed captures

- Desktop wide: [`m5-overview-1440x900-en.png`](./m5-overview-1440x900-en.png),
  [`m5-pod-container-1440x900-ja.png`](./m5-pod-container-1440x900-ja.png),
  [`m5-service-traffic-1440x900-zh-cn.png`](./m5-service-traffic-1440x900-zh-cn.png),
  [`m5-container-restart-1440x900-en.png`](./m5-container-restart-1440x900-en.png), and
  [`m5-pending-scheduling-1440x900-ja.png`](./m5-pending-scheduling-1440x900-ja.png).
- Desktop compact: [`m5-overview-1280x720-ja.png`](./m5-overview-1280x720-ja.png),
  [`m5-pod-container-1280x720-zh-cn.png`](./m5-pod-container-1280x720-zh-cn.png),
  [`m5-service-traffic-1280x720-en.png`](./m5-service-traffic-1280x720-en.png),
  [`m5-container-restart-1280x720-ja.png`](./m5-container-restart-1280x720-ja.png), and
  [`m5-pending-scheduling-1280x720-zh-cn.png`](./m5-pending-scheduling-1280x720-zh-cn.png).
- Mobile: [`m5-overview-390x844-zh-cn.png`](./m5-overview-390x844-zh-cn.png),
  [`m5-pod-container-390x844-en.png`](./m5-pod-container-390x844-en.png),
  [`m5-service-traffic-390x844-ja.png`](./m5-service-traffic-390x844-ja.png),
  [`m5-container-restart-390x844-zh-cn.png`](./m5-container-restart-390x844-zh-cn.png), and
  [`m5-pending-scheduling-390x844-en.png`](./m5-pending-scheduling-390x844-en.png).

## Manual checklist

- [x] Guided scenes use the orthographic teaching camera.
- [x] Explore offers orthographic, perspective, and deterministic reset controls.
- [x] Camera transitions are cancelable; reduced motion reaches the settled pose immediately.
- [x] Desktop Explore no longer reserves a permanent left navigation sidebar.
- [x] The compact legend remains visible without overlapping camera controls or the scene caption.
- [x] Mobile view tabs expose all six grammars without horizontal clipping.
- [x] Mobile labels never exceed the shared total budget of three.
- [x] Teaching callouts count against that budget and never collide with managed labels.
- [x] A selected mobile object opens a bounded bottom inspector while preserving visible scene.
- [x] Mobile exposes Reset when a desktop-only filter remains active.
- [x] Pending mobile captures retain the unscheduled-lane heading, and completion UI cannot cover
      “What changed.”
- [x] Fixed teaching and evidence UI remains readable beside or below the scene.
- [x] No active route, arrowhead, primary label, or focused runtime object is clipped.
- [x] The screenshots are accepted as M5 review evidence, not as a replacement for later M6 route
      and M8 curriculum-story acceptance.
