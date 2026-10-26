/**
 * What Esc / B does on the Board right now, so a hint promises only what happens (`scenes/board.ts#actOnIntent`,
 * "cancel"): it backs out of whatever is open (a guide gate or step, the log's focus, a tip toast, a selection in
 * progress), and only when none of those is open does it open Pause.
 */

export interface EscapeState {
  readonly guideGateOpen: boolean;
  readonly guideStepActive: boolean;
  readonly logFocused: boolean;
  readonly tipShown: boolean;
  readonly selectionIdle: boolean;
}

export function escapeMeaning(state: EscapeState): "back" | "pause" {
  const somethingOpen =
    state.guideGateOpen || state.guideStepActive || state.logFocused || state.tipShown || !state.selectionIdle;
  return somethingOpen ? "back" : "pause";
}
