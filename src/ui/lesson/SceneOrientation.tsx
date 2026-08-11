import { Layers3 } from 'lucide-react';
import type { Locale } from '../../app/types';
import type { ViewMode } from '../../course/types';
import { viewPresentation } from '../../app/entityPresentation';

export interface SceneOrientationProps {
  readonly view: ViewMode;
  readonly locale: Locale;
}

export function SceneOrientation({ view, locale }: SceneOrientationProps) {
  const copy = viewPresentation(view, locale);
  return (
    <aside
      className="scene-orientation"
      data-view={view}
      data-testid="scene-orientation"
      aria-label={copy.title}
    >
      <div className="scene-orientation__heading">
        <Layers3 size={15} aria-hidden="true" />
        <span>{copy.title}</span>
      </div>
      <strong>{copy.question}</strong>
      <ol>
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {copy.note ? <p>{copy.note}</p> : null}
    </aside>
  );
}
