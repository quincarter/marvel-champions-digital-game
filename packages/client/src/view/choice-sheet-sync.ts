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
 */

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
