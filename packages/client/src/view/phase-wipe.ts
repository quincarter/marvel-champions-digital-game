/**
 * The phase/round transition band: when it fires, what it says, and the
 * three-stage timeline (slide in, hold, slide out) a redraw mid-flight has to
 * be able to recompute from a start time alone — every Board draw tears down
 * the display list (`scenes/board/motion.ts`'s own file comment), so nothing
 * here ever holds a live Phaser object.
 *
 * It fires on a `stepChanged` whose phase actually turns — "player" <->
 * "villain", or the game's very first "setup" -> "player" — never on a step
 * change that stays within one phase (`enemyActivations` -> `dealEncounterCards`
 * says nothing new here; the chrome's step label already covers that).
 * `roundStarted` always lands in the same event batch as the `stepChanged`
 * that follows it (the engine's `flow.ts` emits `roundStarted` immediately
 * before `beginPlayerPhase`, in the same command), so the caption can read
 * the new round straight off that batch.
 */

import type { GameEvent } from "@mc/engine";
import { clampedProgress } from "./motion-math.js";

/** How long the band holds at full width once it has slid in. */
export const PHASE_WIPE_HOLD_MS = 900;

/** Reduced motion drops the slide; this is how long the plain caption holds instead. */
export const PHASE_WIPE_REDUCED_MS = 700;

/** How long the chrome's round-chip pop and phase-toggle fade-in take. */
export const PHASE_POP_MS = 200;

export interface PhaseTransition {
  readonly to: "player" | "villain";
  /** The round the table is now on, only when this transition is the one that turned it (crossing into the player phase). Null crossing into the villain phase, which never changes the round. */
  readonly round: number | null;
  readonly caption: string;
}

function captionFor(to: "player" | "villain", round: number | null): string {
  if (to === "villain") return "VILLAIN PHASE";
  return round === null ? "PLAYER PHASE" : `ROUND ${round} · PLAYER PHASE`;
}

/** The transition a fresh batch of events carries, or null when the phase didn't turn. */
export function phaseTransitionFrom(events: readonly GameEvent[]): PhaseTransition | null {
  const crossing = events.find(
    (event): event is Extract<GameEvent, { type: "stepChanged" }> =>
      event.type === "stepChanged" &&
      event.to.phase !== event.from.phase &&
      (event.to.phase === "player" || event.to.phase === "villain"),
  );
  if (!crossing) return null;
  const roundStarted = events.find(
    (event): event is Extract<GameEvent, { type: "roundStarted" }> => event.type === "roundStarted",
  );
  const round = roundStarted?.round ?? null;
  // The `find` predicate above already restricted `to.phase` to these two; TS can't carry that narrowing through
  // the `Extract<..., "stepChanged">` type guard, so it's restated here rather than widened back to `GameStep["phase"]`.
  const to: "player" | "villain" = crossing.to.phase === "villain" ? "villain" : "player";
  return { to, round, caption: captionFor(to, round) };
}

export type WipeStage = "in" | "hold" | "out";

export interface WipeFrame {
  readonly stage: WipeStage;
  /** 0 at the start of this stage, 1 at its end. */
  readonly progress: number;
  readonly remainingMs: number;
}

/**
 * Where the band is at `elapsedMs` since it started, in the three-stage
 * timeline: slide in over `slideMs`, hold for `holdMs`, slide out over
 * `slideMs`. Null once the whole thing is over — the caller drops the motion.
 */
export function wipeFrame(elapsedMs: number, slideMs: number, holdMs: number = PHASE_WIPE_HOLD_MS): WipeFrame | null {
  if (elapsedMs < slideMs)
    return { stage: "in", progress: clampedProgress(elapsedMs, slideMs), remainingMs: slideMs - elapsedMs };
  const sinceHold = elapsedMs - slideMs;
  if (sinceHold < holdMs)
    return { stage: "hold", progress: clampedProgress(sinceHold, holdMs), remainingMs: holdMs - sinceHold };
  const sinceOut = sinceHold - holdMs;
  if (sinceOut < slideMs)
    return { stage: "out", progress: clampedProgress(sinceOut, slideMs), remainingMs: slideMs - sinceOut };
  return null;
}
