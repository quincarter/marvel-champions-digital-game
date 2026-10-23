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

/**
 * The one line a step chip shows under its heading: what that step did. A "paused" beat is only the headline while the
 * screen really is paused; once the decision is answered the step shows its latest *result* ("Sabretooth hit Phoenix
 * for 3"), never the stale "Auto-advance paused" note. Empty when nothing but a pause has happened yet and the screen
 * is no longer paused.
 */
export function stepCaptionOf(beats: readonly WalkthroughBeat[], pausedNow: boolean): string {
  const last = beats[beats.length - 1];
  if (!last) return "";
  if (pausedNow || !last.pause) return last.text;
  for (let i = beats.length - 1; i >= 0; i--) {
    const beat = beats[i]!;
    if (!beat.pause) return beat.text;
  }
  return "";
}

/**
 * "Hold encounter cards" (S1, `settings.holdEncounterCards`): the reveal cursor stops on the last beat of each
 * revealed encounter card until the player moves past it, so a card that resolved inside the same command as the next
 * one still gets read (#128). Returns the card being held at `revealed` beats shown, or null when the cursor may move
 * on: the next beat belongs to the same card, there is no next beat yet, or the player already released this card.
 */
export function encounterHoldAt(
  beats: readonly WalkthroughBeat[],
  revealed: number,
  released: ReadonlySet<string>,
): string | null {
  const current = beats[revealed - 1];
  const following = beats[revealed];
  const card = current?.encounterInstanceId;
  if (!card || !following) return null;
  if (following.encounterInstanceId === card) return null;
  return released.has(card) ? null : card;
}

/**
 * "Flip each encounter card" (`settings.flipEncounterCards`, #287): the reveal cursor stops on the first beat of each
 * encounter card a player was dealt facedown, before the card's face is shown, until the player presses Flip
 * Encounter Card. Returns the card waiting to be flipped at `revealed` beats shown, or null: the current beat is not a
 * card's first beat (the cursor is mid-card, or on a step that is not a reveal), the card was not dealt facedown (a
 * card an effect revealed straight off the deck), or the player already flipped it.
 */
export function flipGateAt(
  beats: readonly WalkthroughBeat[],
  revealed: number,
  dealt: ReadonlySet<string>,
  flipped: ReadonlySet<string>,
): string | null {
  const card = beats[revealed - 1]?.encounterInstanceId;
  if (!card || !dealt.has(card) || flipped.has(card)) return null;
  const before = beats[revealed - 2]?.encounterInstanceId;
  return before === card ? null : card;
}

/**
 * Where the reveal cursor lands under reduced motion, which has no reveal timer: every known beat at once, except that
 * it still stops where the player asked to (`stopsAt`: a facedown card waiting on Flip Encounter Card, a held card
 * waiting on Next card). Reduced motion takes away the pacing, never those stops (#342: the phase jumped straight
 * to its recap past the facedown card). Never moves the cursor back.
 */
export function reducedMotionRevealTo(revealed: number, total: number, stopsAt: (revealed: number) => boolean): number {
  let at = revealed;
  while (at < total && !stopsAt(at)) at++;
  return at;
}

/**
 * True when the beat on screen is an activation `card` started (a treachery's "Rhino schemes", Dark Designs): the reveal
 * body then shows that activation, its boost cards and breakdown, the way step 2 shows one, instead of the card (#370).
 * The walkthrough clears the activation at each reveal, so one stamped on this card's beat is this card's own.
 */
export function encounterCardActivates(beat: WalkthroughBeat | null, card: string | null): boolean {
  return card !== null && beat?.encounterInstanceId === card && beat.activation !== null;
}

/** A Flip Encounter Card press: which card, when (the scene clock's `now`), and whether its end timer has fired. */
export interface FlipInProgress {
  readonly card: string;
  readonly startedAt: number;
  readonly settled: boolean;
}

/**
 * The card still turning over at `now`, or null. Once the turn's end timer has fired (`settled`) the card is done,
 * whatever the clock says: Phaser elapses timers on the loop's smoothed frame delta but sets `now` from the raw frame
 * time, so the timer can fire a few ms before `now - startedAt` reaches the duration. Going by the clock alone, the
 * redraw from that timer still saw the card turning, drew it with no Next card button, and nothing redrew it again: the
 * phase stopped on the card for good (#315, an Android phone capped to 30 fps by power saving).
 */
export function flipTurningAt(flip: FlipInProgress | null, now: number, durationMs: number): string | null {
  if (!flip || flip.settled) return null;
  return now - flip.startedAt < durationMs ? flip.card : null;
}

/** The Flip button's label, in one place for the rail, the peek banner and the full-screen panel. */
export const flipLabel = "Flip Encounter Card";

/** The default flip: the back narrows to nothing, then the face widens (`flipFrameAt`); `settings.flipEncounterSpeed` sets the real length. */
export const FLIP_MS = 500;

export interface FlipFrame {
  /** Which side of the card shows: the back in the first half, the face in the second. */
  readonly side: "back" | "face";
  /** Horizontal scale of the card, 1 = full width, 0 = edge-on. */
  readonly scaleX: number;
}

/** The flip `elapsedMs` in, as plain data so a full redraw mid-flip recreates it where it was. */
export function flipFrameAt(elapsedMs: number, durationMs: number = FLIP_MS): FlipFrame {
  const progress = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
  return progress < 0.5 ? { side: "back", scaleX: 1 - progress * 2 } : { side: "face", scaleX: progress * 2 - 1 };
}
