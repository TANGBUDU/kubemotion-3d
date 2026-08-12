import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepTimeline } from '../../src/ui/lesson/StepTimeline';

const titles = Array.from({ length: 10 }, (_, index) => `Step ${index + 1}`);
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

function rect(left: number, right: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right,
    top: 0,
    bottom: 44,
    width: right - left,
    height: 44,
    toJSON: () => ({}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const [name, descriptor] of [
    ['scrollTo', originalScrollTo],
    ['scrollWidth', originalScrollWidth],
    ['clientWidth', originalClientWidth],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  }
});

describe('StepTimeline active-step positioning', () => {
  it('positions immediately when the lesson or step changes without stealing focus', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: function scrollWidth(this: HTMLElement) {
        return this.classList.contains('timeline-scroll') ? 300 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: function clientWidth(this: HTMLElement) {
        return this.classList.contains('timeline-scroll') ? 100 : 0;
      },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('timeline-scroll')) return rect(0, 100);
      if (this.getAttribute('aria-current') === 'step') {
        return this.textContent === '10' ? rect(200, 232) : rect(8, 40);
      }
      return rect(0, 0);
    });
    const { rerender } = render(
      <>
        <button type="button">Outside control</button>
        <StepTimeline
          lessonId="lesson-a"
          locale="en"
          titles={titles}
          currentStep={0}
          onStepChange={() => undefined}
        />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '#/');
    const outside = screen.getByRole('button', { name: 'Outside control' });
    outside.focus();

    rerender(
      <>
        <button type="button">Outside control</button>
        <StepTimeline
          lessonId="lesson-a"
          locale="en"
          titles={[...titles]}
          currentStep={9}
          onStepChange={() => undefined}
        />
      </>,
    );

    expect(scrollTo).toHaveBeenCalledWith({ left: 140, behavior: 'auto' });
    expect(screen.getByRole('button', { name: 'Outside control' })).toHaveFocus();
    const callCount = scrollTo.mock.calls.length;

    const localizedTitles = titles.map((_, index) => `Localized step ${index + 1}`);
    rerender(
      <>
        <button type="button">Outside control</button>
        <StepTimeline
          lessonId="lesson-a"
          locale="ja"
          titles={localizedTitles}
          currentStep={9}
          onStepChange={() => undefined}
        />
      </>,
    );
    expect(scrollTo).toHaveBeenCalledTimes(callCount);

    rerender(
      <>
        <button type="button">Outside control</button>
        <StepTimeline
          lessonId="lesson-b"
          locale="ja"
          titles={localizedTitles}
          currentStep={9}
          onStepChange={() => undefined}
        />
      </>,
    );
    expect(scrollTo).toHaveBeenCalledTimes(callCount + 1);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 140, behavior: 'auto' });
    expect(screen.getByRole('button', { name: 'Outside control' })).toHaveFocus();

    window.dispatchEvent(new Event('resize'));
    expect(scrollTo).toHaveBeenCalledTimes(callCount + 2);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 140, behavior: 'auto' });
    expect(screen.getByRole('button', { name: 'Outside control' })).toHaveFocus();
  });
});
