/**
 * The landing page's scroll motion: a pinned section that steps through its pictures as the page scrolls past it
 * ("scrollytelling"), pieces that rise into place as they come into view, and wallpaper bands that drift slower than
 * the page. All of it is off under `prefers-reduced-motion`, where the page reads as a plain column.
 *
 * The step maths is pure (`scrollSteps`) so it is tested without a browser.
 */

export interface StepPosition {
  /** The step on screen, 0-based. */
  readonly index: number;
  /** How far through that step the scroll is, 0 to 1. */
  readonly within: number;
  /** How far through the whole section, 0 to 1. */
  readonly progress: number;
}

/**
 * Where a pinned section of `count` steps is: `top` is the section's top relative to the viewport (negative once it
 * has scrolled up), `height` the section's height and `viewport` the window's. The section scrolls by
 * `height - viewport` while its pinned frame stays put, and that distance is split evenly between the steps.
 */
export function scrollSteps(top: number, height: number, viewport: number, count: number): StepPosition {
  const travel = Math.max(1, height - viewport);
  const progress = Math.min(1, Math.max(0, -top / travel));
  const exact = Math.min(count - 1e-6, progress * count);
  const index = Math.max(0, Math.floor(exact));
  return { index, within: exact - index, progress };
}

/** The scroll position (page Y) that puts a pinned section on step `index`, mid-step. */
export function scrollTopForStep(sectionTop: number, height: number, viewport: number, count: number, index: number) {
  const travel = Math.max(1, height - viewport);
  return sectionTop + ((index + 0.5) / count) * travel;
}

export const reducedMotion = (): boolean =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Adds `in` to each `.reveal` under `root` the first time it scrolls into view (and at once under reduced motion).
 * Elements added later are picked up by calling the returned function again.
 */
export function revealOnScroll(root: ParentNode): () => void {
  const observer =
    reducedMotion() || typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("in");
              observer?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
        );
  return () => {
    for (const element of root.querySelectorAll(".reveal:not(.in)")) {
      if (observer) observer.observe(element);
      else element.classList.add("in");
    }
  };
}

/** Runs `frame` on the next animation frame after each scroll or resize, at most once a frame. */
export function onScrollFrame(frame: () => void): void {
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      frame();
    });
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  queue();
}
