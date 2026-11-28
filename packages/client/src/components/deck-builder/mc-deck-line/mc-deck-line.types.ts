import type { CopyButtonModel } from "../mc-copy-buttons/mc-copy-buttons.types.js";

/** One line of "Your deck": a card, its copies and its own "-". */
export interface DeckLineModel {
  readonly cardId: string;
  readonly name: string;
  readonly quantity: number;
  /** Why the line is pinned or a reward ("... one of your 50."), wrapped, not cut; null for a plain line. */
  readonly note: string | null;
  readonly minus: CopyButtonModel;
  /** A plain press opens the card (a campaign grant: the list is the only place to read it); otherwise only a hold does. */
  readonly openOnTap: boolean;
  /** The granted face in a campaign (the Enhanced side), what Inspect and the popover open on. */
  readonly face: string | null;
}
