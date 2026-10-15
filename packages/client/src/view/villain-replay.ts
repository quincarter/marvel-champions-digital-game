/**
 * Where the villain-phase replay stands against the game the engine has already finished.
 *
 * The engine runs a whole villain phase (and often the start of the next round) inside one command, so the table, the
 * pending decision and the outcome are all the engine's *end* state while the rail is still replaying the first beats.
 * Everything here is a plain function of the walkthrough and the reveal cursor, so the scene can hold each of those back
 * until the rail reaches them (the QA of 2026-10-15: the board showed round 2 and "Your turn" over round 1's step 2).
 */
import { revealOf } from "./villain-phase-reveal.js";
import { VILLAIN_STEPS, type Walkthrough } from "./villain-walkthrough.js";

export const totalBeats = (walkthrough: Walkthrough): number =>
  walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

/**
 * Whether the replay has reached the open decision. The engine parks a pause on the last beat it has recorded, so a
 * pending decision belongs to the last beat: until the cursor is there, an earlier activation is still being shown and
 * a decision from a later one would sit under the wrong headline.
 */
export function decisionReached(paused: boolean, revealed: number, total: number): boolean {
  return !paused || revealed >= total;
}

/** What the table's chrome says while the rail is still replaying: the round and the step being shown. */
export interface TableHold {
  readonly round: number;
  /** "Villain phase · step 2 of 5". */
  readonly stepLabel: string;
}

/**
 * The chrome the table wears while the replay is behind the engine; null once the replay has caught up (the live game
 * is then the game being shown) or when there is nothing to replay.
 */
export function tableHoldOf(walkthrough: Walkthrough, revealed: number): TableHold | null {
  const total = totalBeats(walkthrough);
  if (total === 0 || revealed >= total) return null;
  const active = revealOf(walkthrough, revealed).steps.find((step) => step.revealStatus === "active");
  return {
    round: walkthrough.round,
    stepLabel: active
      ? `Villain phase · step ${active.number} of ${VILLAIN_STEPS.length}`
      : "Villain phase · about to begin",
  };
}

/** Whether a finished game's outcome screen may replace the rail: every beat has been shown (or there is nothing to show). */
export const outcomeReleasable = (revealed: number, total: number): boolean => revealed >= total;

/**
 * The heading over a held decision: who decides and what it is about. With one seat it is "Your decision"; with
 * several (hot-seat especially) the deciding seat is named every time, since "your" is whoever is holding the device.
 */
export function decisionTitleOf(input: {
  readonly seatCount: number;
  readonly deciderName: string;
  /** "Electro attacks You" while an activation is the thing being decided about, else null. */
  readonly activation: string | null;
  /** The card the decision is about when it is not an activation (a revealed encounter card), else null. */
  readonly subject: string | null;
}): string {
  const who = input.seatCount > 1 ? input.deciderName : "Your decision";
  const about = input.activation ?? input.subject ?? "The villain phase";
  return `${who} — ${about}`;
}

/** A seat named for a heading: "Spider-Man (Peter Parker)" is "Spider-Man", which is what the table calls the seat. */
export const seatHeadingName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, "");
