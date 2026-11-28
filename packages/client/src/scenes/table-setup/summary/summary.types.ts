import type { Scenario } from "@mc/content";
import type { GameSummaryRow } from "../../../view/table-setup-preview.js";

/** What the "game you'll get" section shows: the summary, the seed, the watch choice, the villain and the Deal button. */
export interface SummaryInput {
  readonly rows: readonly GameSummaryRow[];
  readonly seedText: string;
  readonly watchable: boolean;
  /** A room's table: its game is always watchable and Deal returns to the lobby. */
  readonly room: boolean;
  readonly scenario: Scenario;
  readonly villainName: string;
  /** Whether the villain picture shows (not for a Civil War build). */
  readonly showVillain: boolean;
  /** "Dealing it out" is under way: Deal and Back wait. */
  readonly starting: boolean;
  /** Why Deal waits (the modular picks, a builder refusal), or null when it can deal. */
  readonly dealBlocked: string | null;
  /** The line over Deal (a seed that is not a number, a failed setup). */
  readonly status: string;
  /** The phone footer's one summary line ("Rhino - Stage I - Standard - 1 hero - 1 modular"). */
  readonly footerLine: string;
}

/** What the player changed in the summary section. */
export interface SummaryEvents {
  readonly reroll: () => void;
  readonly toggleWatch: () => void;
  /** Deal it out (or, in a room, back to the lobby). */
  readonly deal: () => void;
  /** A press on the seed row's stop puts the caret in the field. */
  readonly focusSeed: () => void;
}
