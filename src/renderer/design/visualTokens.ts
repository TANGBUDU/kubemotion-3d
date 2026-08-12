import { dimensions } from './dimensions';
import { palette } from './palette';
import { typography } from './typography';

export const visualTokens = Object.freeze({
  palette,
  dimensions,
  typography,
  material: Object.freeze({
    roughnessDefault: 0.58,
    metalnessDefault: 0.09,
    focusEmissiveIntensity: 0.32,
    shellOpacity: 0.24,
    dimmedOpacity: 0.24,
  }),
  layer: Object.freeze({
    floor: 0,
    context: 2,
    entity: 4,
    activeRoute: 12,
    focus: 16,
    label: 20,
  }),
});
