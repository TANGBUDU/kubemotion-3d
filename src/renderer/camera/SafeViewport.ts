export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface SafeViewportInput {
  readonly viewport: ViewportSize;
  readonly insets?: Partial<ViewportInsets>;
  readonly exclusions?: readonly ViewportRect[];
  readonly safeFrameRatio?: number;
}

const clampSize = (value: number): number => Math.max(1, Number.isFinite(value) ? value : 1);
const area = (rect: ViewportRect): number => Math.max(0, rect.width) * Math.max(0, rect.height);

const intersection = (left: ViewportRect, right: ViewportRect): ViewportRect | undefined => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  if (maxX <= x || maxY <= y) return undefined;
  return { x, y, width: maxX - x, height: maxY - y };
};

const largestRemainder = (rect: ViewportRect, excluded: ViewportRect): ViewportRect => {
  const overlap = intersection(rect, excluded);
  if (!overlap) return rect;
  const candidates: readonly ViewportRect[] = [
    { x: rect.x, y: rect.y, width: overlap.x - rect.x, height: rect.height },
    {
      x: overlap.x + overlap.width,
      y: rect.y,
      width: rect.x + rect.width - overlap.x - overlap.width,
      height: rect.height,
    },
    { x: rect.x, y: rect.y, width: rect.width, height: overlap.y - rect.y },
    {
      x: rect.x,
      y: overlap.y + overlap.height,
      width: rect.width,
      height: rect.y + rect.height - overlap.y - overlap.height,
    },
  ];
  return (
    [...candidates]
      .filter((candidate) => candidate.width > 0 && candidate.height > 0)
      .sort((left, right) => area(right) - area(left))[0] ?? {
      x: overlap.x,
      y: overlap.y,
      width: 0,
      height: 0,
    }
  );
};

const insetRect = (rect: ViewportRect, amountX: number, amountY: number): ViewportRect => ({
  x: rect.x + amountX,
  y: rect.y + amountY,
  width: Math.max(0, rect.width - amountX * 2),
  height: Math.max(0, rect.height - amountY * 2),
});

export class SafeViewport {
  public readonly viewport: ViewportSize;
  public readonly contentRect: ViewportRect;
  public readonly safeRect: ViewportRect;

  public constructor(input: SafeViewportInput) {
    this.viewport = {
      width: clampSize(input.viewport.width),
      height: clampSize(input.viewport.height),
    };
    const insets = {
      top: Math.max(0, input.insets?.top ?? 0),
      right: Math.max(0, input.insets?.right ?? 0),
      bottom: Math.max(0, input.insets?.bottom ?? 0),
      left: Math.max(0, input.insets?.left ?? 0),
    };
    let content: ViewportRect = {
      x: insets.left,
      y: insets.top,
      width: Math.max(0, this.viewport.width - insets.left - insets.right),
      height: Math.max(0, this.viewport.height - insets.top - insets.bottom),
    };
    for (const exclusion of input.exclusions ?? []) {
      content = largestRemainder(content, exclusion);
    }
    this.contentRect = content;
    const ratio = Math.min(0.2, Math.max(0, input.safeFrameRatio ?? 0.06));
    this.safeRect = insetRect(content, content.width * ratio, content.height * ratio);
  }

  public get aspect(): number {
    return this.hasUsableArea
      ? this.safeRect.width / this.safeRect.height
      : this.viewport.width / this.viewport.height;
  }

  public get widthFraction(): number {
    return this.safeRect.width / this.viewport.width;
  }

  public get heightFraction(): number {
    return this.safeRect.height / this.viewport.height;
  }

  public get hasUsableArea(): boolean {
    return this.safeRect.width > 0 && this.safeRect.height > 0;
  }

  public get centerNdc(): Readonly<{ x: number; y: number }> {
    if (!this.hasUsableArea) return { x: 0, y: 0 };
    const centerX = this.safeRect.x + this.safeRect.width / 2;
    const centerY = this.safeRect.y + this.safeRect.height / 2;
    return {
      x: (centerX / this.viewport.width) * 2 - 1,
      y: 1 - (centerY / this.viewport.height) * 2,
    };
  }

  public contains(rect: ViewportRect): boolean {
    if (!this.hasUsableArea) return false;
    return (
      rect.x >= this.safeRect.x &&
      rect.y >= this.safeRect.y &&
      rect.x + rect.width <= this.safeRect.x + this.safeRect.width &&
      rect.y + rect.height <= this.safeRect.y + this.safeRect.height
    );
  }
}

export const createSafeViewport = (input: SafeViewportInput): SafeViewport =>
  new SafeViewport(input);
