import type { PictureSource } from "@mc/ui";
import type { CopyButtonModel } from "../mc-copy-buttons/mc-copy-buttons.types.js";

/** A card as the pool draws it: everything is already worded, so the elements have no rules of their own. */
export interface PoolCardModel {
  readonly cardId: string;
  /** The card scan (a leased picture): fitted whole; `missing` says the name when there is none. */
  readonly picture: PictureSource;
  /** The name, fitted to its cell by the scene (a subtitle that did not fit goes to `caption`). */
  readonly title: string;
  /** The printed cost, or null for a card with none (no pip). */
  readonly cost: number | null;
  /** Card view: the line under the name (type, why it is offered, a campaign mark). */
  readonly caption: string;
  /** The caption is a note the player should read (drawn stronger than a plain type line). */
  readonly captionStrong: boolean;
  /** List view: the type line, the why-offered note and the rules text. */
  readonly typeLine: string;
  readonly note: string | null;
  readonly rules: string;
  /** Copies in the deck: more than none draws a red, heavier frame in Card view. */
  readonly quantity: number;
  readonly minus: CopyButtonModel;
  readonly plus: CopyButtonModel;
  /** The card's granted face in a campaign (MC27 p. 22's Enhanced side): what Inspect and the popover open on. */
  readonly face: string | null;
}
