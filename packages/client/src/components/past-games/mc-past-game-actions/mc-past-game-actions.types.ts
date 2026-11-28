import type { PastGameAction } from "../../../view/past-games-model.js";

/** One of a game's four actions, its words already translated ("Working..." while it runs). */
export interface PastGameActionButton {
  readonly action: PastGameAction;
  readonly label: string;
}

export interface McPastGameActionsProps {
  /** The game these actions are for. */
  readonly gameId: string;
  readonly actions: readonly PastGameActionButton[];
  /** One action is running (or the file picker): every button is dimmed and does nothing. */
  readonly busy: boolean;
}
