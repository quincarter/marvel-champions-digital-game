/**
 * What the pending-choice sheet (`scenes/choice.ts`) should do with a store
 * update, given where it is in its own open/answer/leave cycle.
 *
 * The sheet fades itself out the instant it dispatches an answer
 * (`OverlayMotion.exit`, "leaving"), and the Board stops the scene once the
 * answered decision leaves the state (`BoardScene#syncChoiceOverlay`). That
 * hand-off has one gap: the engine can answer one decision and raise the next
 * inside the *same* command — a chosen target followed by a "which trigger?"
 * or a defend prompt, most of the villain phase's pauses, Discard-to-hand-size
 * straight into Breakout's forced response. The state then never once reads
 * "no pending choice", so the Board neither stops nor relaunches the scene,
 * and a sheet that only ever drew again once it had *stopped* leaving sat
 * faded to nothing over a decision the engine was waiting on (the 2026-09-21
 * "the popup didn't take precedence, I had to quit and resume" report; resume
 * restarts the Board, which is why it appeared to fix it).
 *
 * So a leaving sheet still watches the choice *id*: the same id means its own
 * answer is still in flight (hold); a different id means a new decision has
 * arrived, and the sheet restarts its entrance on it as if freshly launched.
 * The "id" it watches is `choiceSheetKey`, not the bare choice id.
 */

import type { PendingChoice } from "@mc/engine";

/**
 * What the sheet knows a decision by, wherever it compares "the one I drew" with "the one the store carries": its
 * picks, its privacy cover's reveal and its own answer-in-flight hold all belong to one decision.
 *
 * The choice id alone does not name one. Ids count up with the engine's `nextChoiceSeq`, which Undo and Back out
 * (`SessionStore.rewindTo`) rewind with the rest of the state, and which starts again in every new game. So the next
 * decision after an undo can carry the very id of the one undone: a target picked on the undone sheet (the villain)
 * stayed picked under the end-of-turn discard that took its id, invisible and counted, and the hand's last card could
 * not be picked (issue #211). The seat, the question and its options tell two such decisions apart.
 */
export function choiceSheetKey(choice: Pick<PendingChoice, "choiceId" | "playerId" | "prompt" | "options">): string {
  return [choice.choiceId, choice.playerId, choice.prompt.kind, choice.options.map((o) => o.optionId).join(",")].join(
    "|",
  );
}

export interface ChoiceSheetSyncInput {
  /** `OverlayMotion.leaving`: an answer was dispatched and the sheet is fading out. */
  readonly leaving: boolean;
  /** The id of the decision the sheet last drew (or is fading out on). Null before its first draw. */
  readonly shownChoiceId: string | null;
  /** The id of the decision the store currently carries. Null when there is none. */
  readonly pendingChoiceId: string | null;
}

export type ChoiceSheetAction =
  /** Nothing to show: no decision is open (the Board stops the scene), or the sheet's own answer is still in flight. */
  | "hold"
  /** Draw the pending decision as usual. */
  | "draw"
  /** A *new* decision arrived while the sheet was fading out on the last one: reset the motion and draw it fresh. */
  | "restart";

export function choiceSheetAction(input: ChoiceSheetSyncInput): ChoiceSheetAction {
  if (input.pendingChoiceId === null) return "hold";
  if (!input.leaving) return "draw";
  return input.pendingChoiceId === input.shownChoiceId ? "hold" : "restart";
}

/** How long an answered sheet may sit on an unchanged, idle decision before it gives the decision back. */
export const STUCK_SHEET_GRACE_MS = 1200;

export interface StuckSheetInput {
  readonly leaving: boolean;
  readonly shownChoiceId: string | null;
  readonly pendingChoiceId: string | null;
  /** `SessionState.inFlight`: a command is on its way to the engine. */
  readonly inFlight: boolean;
  /** How long the sheet has been leaving on this same decision with nothing in flight. */
  readonly idleForMs: number;
}

/**
 * True when an answered sheet should come back: it is marked as leaving, the *same* decision is still open, and no
 * command is on its way. After a Confirm the store marks a command in flight at once, and the engine's reply either
 * raises a different decision (`choiceSheetAction`'s "restart") or is refused (the sheet's own `#confirm` brings it
 * back) — so this state should never last. If it ever does, the sheet would sit there ignoring every click with the
 * engine waiting on it (the 2026-09-21 "frozen on the defend screen, a refresh fixed it" report, which could not be
 * reproduced), so after a short grace it simply becomes answerable again.
 */
export function stuckSheetShouldRecover(input: StuckSheetInput): boolean {
  return (
    input.leaving &&
    !input.inFlight &&
    input.pendingChoiceId !== null &&
    input.pendingChoiceId === input.shownChoiceId &&
    input.idleForMs >= STUCK_SHEET_GRACE_MS
  );
}

/**
 * True when another screen is drawn over the decision sheet and answers its decision itself: the villain-phase
 * walkthrough's inline interrupt window (`scenes/villain-phase.ts`) sits above the sheet and offers the same answers.
 * The covered sheet must not take a press, answer a key, or publish rects a click test could aim at: "Confirm" on a
 * sheet nobody can see is how a hidden control sits where the visible "Let it resolve" is.
 */
export function sheetIsCovered(order: {
  readonly coverActive: boolean;
  readonly coverIndex: number;
  readonly sheetIndex: number;
}): boolean {
  return order.coverActive && order.coverIndex > order.sheetIndex;
}
