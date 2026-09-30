/**
 * The pure half of firing the round debrief at the end of a guided run's round (guided mode G8 part 2,
 * `docs/guided-mode.md` §4 G8): where to split a fresh batch of events at the round boundary, and whether this
 * round's debrief should fire at all. `scenes/board/guide-mount.ts#noteRoundEvents` is the Phaser-side caller —
 * kept here so the boundary math and the "fire once per round, but never again once the run is complete" rule are
 * Vitest-tested without a live scene.
 *
 * A `roundStarted` event always lands in the same batch as the `stepChanged` that crosses into the new round's
 * player phase (`view/phase-wipe.ts`'s own header), so a fresh command's events split cleanly into "the round that
 * just ended" (everything up to and including the events before `roundStarted`) and "the new round" (everything
 * from `roundStarted` on).
 */
import type { GameEvent } from "@mc/engine";

export interface RoundEventSplit {
  /** `null` when this batch carries no `roundStarted` — nothing to debrief yet, keep accumulating. */
  readonly finished: { readonly round: number; readonly events: readonly GameEvent[] } | null;
  /** The new round's own events so far — `carried` next time, whether or not a boundary was found. */
  readonly carried: readonly GameEvent[];
}

/**
 * Splits `fresh` (this command's own events) against `carried` (every event already accumulated for the round
 * still in progress) at the first `roundStarted` event, if any.
 *
 * **Round 1's own opening `roundStarted` never finishes anything.** `executePlayerSetupAbilities`
 * (`packages/engine/src/flow.ts`, RRG 1.8 Appendix II step 16, p. 51) emits `{ type: "roundStarted", round: 1 }`
 * once, at the very end of setup — there is no round 0 that just ended, so treating it as a boundary would queue a
 * debrief titled "End of round 0" the instant a guided game starts (found in browser verification: it fired mid-
 * villain-phase-1, the first moment the band/overlay gate let it show, well before the real round-1 debrief). Every
 * *other* `roundStarted` (`executeEndOfRound`) always follows a round that genuinely just played out.
 */
export function splitAtRoundBoundary(carried: readonly GameEvent[], fresh: readonly GameEvent[]): RoundEventSplit {
  const boundary = fresh.findIndex((event) => event.type === "roundStarted");
  if (boundary === -1) return { finished: null, carried: [...carried, ...fresh] };
  const roundStarted = fresh[boundary] as Extract<GameEvent, { type: "roundStarted" }>;
  const carriedAfter = fresh.slice(boundary);
  if (roundStarted.round <= 1) return { finished: null, carried: carriedAfter };
  return {
    finished: { round: roundStarted.round - 1, events: [...carried, ...fresh.slice(0, boundary)] },
    carried: carriedAfter,
  };
}

/**
 * Whether the round that just ended should show its own debrief (`docs/guided-mode.md` §4 G8 part 2: "while the
 * tutorial still has lessons left (or on the round where the last lesson completes)"). Every round fires while any
 * lesson remains; once every lesson is done, only the very first round to reach that state still fires — every
 * later round of the same guided game stays silent.
 */
export function shouldFireRoundDebrief(
  doneLessonCount: number,
  totalLessonCount: number,
  alreadyFiredCompleteDebrief: boolean,
): boolean {
  const allDone = doneLessonCount >= totalLessonCount;
  return !allDone || !alreadyFiredCompleteDebrief;
}
