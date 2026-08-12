export const emphasisScale = (emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden'): number =>
  emphasis === 'focused' ? 1.04 : 1;

export const emphasisOpacity = (emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden'): number => {
  if (emphasis === 'hidden') return 0;
  if (emphasis === 'dimmed') return 0.24;
  return 1;
};

export const emphasisEmissiveIntensity = (
  emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden',
): number => (emphasis === 'focused' ? 0.32 : 0);
