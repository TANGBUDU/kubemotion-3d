export const typography = Object.freeze({
  uiFontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  monoFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", ui-monospace, monospace',
  worldLabel: Object.freeze({ fontSizePx: 13, fontWeight: 650, letterSpacingEm: 0.015 }),
  zoneTitle: Object.freeze({ fontSizePx: 12, fontWeight: 750, letterSpacingEm: 0.12 }),
  evidenceLabel: Object.freeze({ fontSizePx: 12, fontWeight: 650 }),
  evidenceValue: Object.freeze({ fontSizePx: 13, fontWeight: 560 }),
});

export const shortResourceName = (name: string, maxLength = 20): string => {
  if (name.length <= maxLength) return name;
  const keep = Math.max(4, maxLength - 1);
  return `${name.slice(0, keep)}…`;
};

export const statusLabel = (status: string): string => status.replaceAll('-', ' ').toUpperCase();
