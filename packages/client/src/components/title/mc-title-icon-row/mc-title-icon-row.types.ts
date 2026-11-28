import type { McIconName } from "@mc/ui";
import type { TitleGlyph } from "../shared/title.types.js";

/** One chrome button of the Title top row. */
export interface TitleIconButton {
  /** Its focus stop and what a press reports (`chrome:theme`, `chrome:language`, ...). */
  readonly key: string;
  readonly icon: McIconName;
  /** Assistive text and tooltip, already translated. */
  readonly name: string;
  /** Short words beside the picture (the language code); such a button is a little wider. */
  readonly label?: string;
  /** A count hung on its top right corner ("3": mod updates in the store). */
  readonly badge?: string;
  /** Drawn as hovered while its pop-up is open. */
  readonly lit?: boolean;
  /** The press glyph hung under it while it has focus. */
  readonly glyph?: TitleGlyph;
}

export interface TitleIconRowInput {
  /** Left to right as drawn: store, Discord, theme, language, music, report. */
  readonly buttons: readonly TitleIconButton[];
}
