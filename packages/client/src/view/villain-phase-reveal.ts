/**
 * Reveal pacing for the villain-phase walkthrough screen.
 *
 * The engine hands the client a whole phase's `GameEvent`s in one burst — often
 * the entire five-step phase in a single command (see `villain-walkthrough.ts`)
 * — but a human reads one beat at a time. This module turns a `Walkthrough`
 * plus "how many beats has the screen shown so far" into exactly what the
 * scene should draw: which steps read as done/active/pending *given what has
 * been revealed*, and which beat is "happening now".
 *
 * This is deliberately a different question from the `Walkthrough`'s own
 * `status`/`activeStep`, which describe where the *engine* actually is. A
 * phase that resolved with no pause is, from the engine's point of view,
 * already `complete` the instant the client sees it; revealing it instantly
 * too would defeat the point of a walkthrough. `revealOf` is what lets the
 * scene hold a beat back until its turn, without inventing any information —
 * every beat it can ever show already exists in the `Walkthrough`.
 *
 * Plain data, no Phaser — the scene only lays this out (PLAN.md Phase 4,
 * "thin scenes, plain-TS view models").
 */

import type { StepStatus, VillainStepView, Walkthrough, WalkthroughBeat } from "./villain-walkthrough.js";

export interface RevealedStep extends VillainStepView {
  /** This step's status as far as the screen has revealed, not the engine's own `status`. */
  readonly revealStatus: StepStatus;
}

export interface Reveal {
  readonly steps: readonly RevealedStep[];
  /** The most recently revealed beat — what the "happening now" panel shows. Null before anything has. */
  readonly current: WalkthroughBeat | null;
  /** True once every beat the walkthrough currently knows about has been shown. */
  readonly caughtUp: boolean;
  /** Every beat across every step, so the scene knows how far there is to go. */
  readonly total: number;
}

/**
 * The walkthrough as it should be drawn after `revealed` beats have been
 * shown. A step ahead of the last revealed beat reads "pending" even if the
 * engine finished it rounds ago — the point of pacing is not to spoil a step
 * the player hasn't been shown yet.
 */
export function revealOf(walkthrough: Walkthrough, revealed: number): Reveal {
  const total = walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);
  const shown = Math.max(0, Math.min(revealed, total));
  const caughtUp = shown >= total;

  const visibleByStep: WalkthroughBeat[][] = [];
  let offset = 0;
  // -1: nothing revealed means no step is done or active yet, whatever the
  // engine itself has already finished.
  let lastStepIndex = -1;
  let current: WalkthroughBeat | null = null;
  for (const step of walkthrough.steps) {
    const take = Math.max(0, Math.min(step.beats.length, shown - offset));
    const visible = step.beats.slice(0, take);
    visibleByStep.push(visible);
    if (visible.length > 0) {
      lastStepIndex = visibleByStep.length - 1;
      current = visible[visible.length - 1]!;
    }
    offset += step.beats.length;
  }

  const steps: RevealedStep[] = walkthrough.steps.map((step, index) => ({
    ...step,
    beats: visibleByStep[index]!,
    revealStatus:
      walkthrough.complete && caughtUp
        ? "done"
        : index < lastStepIndex
          ? "done"
          : index === lastStepIndex
            ? "active"
            : "pending",
  }));

  return { steps, current, caughtUp, total };
}
