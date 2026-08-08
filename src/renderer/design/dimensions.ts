export const dimensions = Object.freeze({
  stage: Object.freeze({ width: 22, depth: 15, floorHeight: 0.28, cornerRadius: 0.42 }),
  node: Object.freeze({
    width: 6.2,
    depth: 3.8,
    chassisHeight: 0.48,
    wallHeight: 0.44,
    bayWidth: 2.12,
    bayDepth: 1.72,
    podLandingY: 0.58,
    bayAnchors: Object.freeze([
      Object.freeze([-1.9, -0.87] as const),
      Object.freeze([0.34, -0.87] as const),
      Object.freeze([-1.9, 0.87] as const),
      Object.freeze([0.34, 0.87] as const),
    ]),
    systemModuleStrip: Object.freeze({
      center: Object.freeze([2.36, 0.58, 0] as const),
      size: Object.freeze([1.4, 0.1, 3.32] as const),
    }),
    kubeletMountOffset: Object.freeze([2.36, 0.74, -0.88] as const),
    runtimeMountOffset: Object.freeze([2.36, 0.74, 0.88] as const),
  }),
  pod: Object.freeze({
    width: 1.72,
    depth: 1.3,
    shellHeight: 1.42,
    headerHeight: 0.3,
    cornerRadius: 0.16,
  }),
  container: Object.freeze({
    width: 0.72,
    depth: 0.62,
    height: 0.62,
    cornerRadius: 0.1,
  }),
  focus: Object.freeze({ ringThickness: 0.045, elevation: 0.055 }),
  camera: Object.freeze({ safeFrameRatio: 0.06, fitPadding: 1.12, minViewHeight: 8 }),
});

export type NodeBayAnchor = (typeof dimensions.node.bayAnchors)[number];
