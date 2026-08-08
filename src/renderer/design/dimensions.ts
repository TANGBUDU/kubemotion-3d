export const dimensions = Object.freeze({
  stage: Object.freeze({ width: 22, depth: 15, floorHeight: 0.28, cornerRadius: 0.42 }),
  node: Object.freeze({
    width: 5.2,
    depth: 3.8,
    chassisHeight: 0.48,
    wallHeight: 0.44,
    bayWidth: 1.72,
    bayDepth: 1.2,
    slotOffsets: Object.freeze([
      Object.freeze([-1.22, -0.82] as const),
      Object.freeze([1.22, -0.82] as const),
      Object.freeze([-1.22, 0.82] as const),
      Object.freeze([1.22, 0.82] as const),
    ]),
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

export type NodeSlotOffset = (typeof dimensions.node.slotOffsets)[number];
