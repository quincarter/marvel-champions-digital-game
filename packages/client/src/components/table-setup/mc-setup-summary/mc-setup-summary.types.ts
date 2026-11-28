import type { PictureSource } from "@mc/ui";
import type { GameSummaryRow } from "../../../view/table-setup-preview.js";

/** The villain this table faces: its artwork (or the encounter card back while it is not known yet) and which card it is. */
export interface SummaryVillain {
  readonly name: string;
  readonly picture: PictureSource;
  /** The villain's card, for the hover and Inspect; null while it is not known (a villain drawn at random). */
  readonly cardId: string | null;
}

/** What the "game you'll get" section shows: the summary, the seed, the watch choice and the villain. */
export interface SummaryInput {
  readonly rows: readonly GameSummaryRow[];
  readonly seedText: string;
  readonly watchable: boolean;
  /** A room's table: its game is always watchable and Deal returns to the lobby. */
  readonly room: boolean;
  /** The villain picture (not for a Civil War build, which has none). */
  readonly villain: SummaryVillain | null;
}
