import type { HintGlyph, PictureSource } from "@mc/ui";
import type { ThumbShape } from "../mc-briefing-card-thumb/mc-briefing-card-thumb.types.js";

/** One option of a pick: its button label and, when every option is a card, the card beside it. */
export interface OptionModel {
  readonly id: string;
  /** The label the button wears: a card name (plus what tells two apart), a scenario title, the villain-method words. */
  readonly label: string;
  readonly card: {
    readonly cardId: string;
    readonly name: string;
    readonly shape: ThumbShape;
    readonly picture: PictureSource;
  } | null;
}

/** A plain pick of options (single or multi), or a random-draw accept / decline. */
export interface OptionsModel {
  /** A random draw: "Take it" / "Decline" (no options). */
  readonly random: boolean;
  /** What accepting a random draw answers with. */
  readonly acceptValue: string;
  readonly options: readonly OptionModel[];
  /** How many must be chosen (1: the press answers; more: toggle and Confirm). */
  readonly count: number;
  /** An optional pick adds Decline. */
  readonly optional: boolean;
  /** The Start glyph on Confirm while a pad is in use. */
  readonly confirmGlyph: HintGlyph | null;
}
