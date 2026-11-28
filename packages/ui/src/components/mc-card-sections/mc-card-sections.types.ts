import type { PictureSource } from "../../shared/picture.types.js";

/** One face of an identity or a multi-faced card: its scan, what it is called and its printed name. */
export interface CardFaceTileModel {
  /** `<group>.<tile>`: the element's key is `face:<id>` and a tap raises `mc-activate` with it. */
  readonly id: string;
  readonly cardId: string;
  readonly picture: PictureSource;
  readonly label: string;
  readonly name: string;
  /** Which face of the card this is, when not its default one: handed to the hover popover and Inspect. */
  readonly face?: unknown;
}

/** One card a deck runs: a cost pip, the name and type over the scan, a line or two of rules and a copies badge. */
export interface CardCellModel {
  /** Raised as `card:<id>` by a tap. */
  readonly id: string;
  readonly cardId: string;
  readonly cost: number | null;
  /** The pip's colour (a CSS colour), as the cost's own ladder. */
  readonly costColor: string;
  readonly name: string;
  readonly typeWord: string;
  readonly picture: PictureSource;
  readonly rules: string;
  readonly quantity: number;
}

/** A section of the scrolling list: a titled row of face tiles, a titled grid of card cells, or a plain line of words. */
export type CardSection =
  | {
      readonly kind: "faces";
      readonly title: string;
      readonly tiles: readonly CardFaceTileModel[];
      readonly tileWidth: number;
      readonly tileHeight: number;
    }
  | { readonly kind: "cards"; readonly title: string; readonly cells: readonly CardCellModel[] }
  | { readonly kind: "note"; readonly text: string };

export interface CardSectionsModel {
  readonly sections: readonly CardSection[];
  /** The width the list takes, px; the scrollbar's gutter comes out of the frame beside it. */
  readonly contentWidth: number;
  readonly columns: number;
  readonly cellHeight: number;
  readonly gap: number;
}
