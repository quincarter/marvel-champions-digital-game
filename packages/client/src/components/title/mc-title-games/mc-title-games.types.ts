import type { TitleRowIcon } from "../mc-title-menu-button/mc-title-menu-button.types.js";
import type { TitleGlyph } from "../shared/title.types.js";

/** One game in progress. */
export interface TitleGameRow {
  readonly id: string;
  /** What the game is ("Rhino · Spider-Man"). */
  readonly title: string;
  /** Campaign line, round and when it was last played, joined with a middle dot. */
  readonly detail: string;
  /** Where it was last played (the platform mark). */
  readonly icon?: TitleRowIcon;
  /** Said in Resume place for a game a newer build wrote ("Played on a newer version..."), else null. */
  readonly needsUpdate: string | null;
  readonly resume: string;
  readonly watch: string;
  readonly remove: string;
}

/** The question that replaces the list: "Remove this game?". */
export interface TitleGameConfirm {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly keep: string;
  readonly remove: string;
  /** Why the last Remove failed, shown under the question. */
  readonly error: string | null;
  /** The Cancel glyph hung on Keep it. */
  readonly keepGlyph?: TitleGlyph;
}

/** The In-progress games panel, already worded and translated. */
export interface TitleGamesInput {
  /** "IN-PROGRESS GAMES (3)". */
  readonly heading: string;
  /** A small tag at the heading ("BETA"). */
  readonly tag?: string;
  /** The key or pad glyph that jumps focus here, at the right of the heading. */
  readonly hint?: TitleGlyph;
  readonly rows: readonly TitleGameRow[];
  readonly confirming: TitleGameConfirm | null;
  /** False while something is already starting: the rows and buttons are drawn unavailable. */
  readonly enabled: boolean;
}
