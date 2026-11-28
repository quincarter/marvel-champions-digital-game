
import type { PictureSource } from "@mc/ui";
import type { ThumbShape } from "../mc-briefing-card-thumb/mc-briefing-card-thumb.types.js";

/** One card an option is about, as a picture and the words under or beside it. */
export interface PickCardModel {
  /** "Scheme", "Earns", "Brings" or an empty word (the option is the card), already translated. */
  readonly caption: string;
  /** The card that is earned from the option: its caption reads green. */
  readonly earned: boolean;
  readonly cardId: string;
  readonly name: string;
  readonly shape: ThumbShape;
  readonly picture: PictureSource;
}

/** A pick card with the key a screen names its stop by ("scheme", "environment", "encounter"). */
export type KeyedPickCard = PickCardModel & { readonly key: string };
