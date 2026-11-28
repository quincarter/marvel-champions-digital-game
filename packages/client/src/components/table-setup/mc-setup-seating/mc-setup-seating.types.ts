import type { PictureSource } from "@mc/ui";

/** One seat of the table: the hero's name and picture, and whether it holds the first player token. */
export interface SeatCell {
  readonly index: number;
  readonly name: string;
  readonly meta: string;
  /** The compact chip's top line: "You" for seat 0, "S2" and on for the rest. */
  readonly chipLabel: string;
  readonly selected: boolean;
  /** The seated deck's hero identity card, for the seat's picture and its hover. */
  readonly identityCardId: string | undefined;
}

/** What the Seating section shows. In a room the players bring their own heroes, so only a note about the seats shows. */
export interface SeatingInput {
  readonly seats: readonly SeatCell[];
  readonly room: boolean;
  /** Each seat's hero picture, by seat index (a seat with none shows its plain ground). */
  readonly pictures: ReadonlyMap<number, PictureSource>;
}

/** Where the first player token is and is drawn now, as elements (the scene reads their rects): what the e2e hook reads. */
export interface TokenProbe {
  readonly index: number;
  /** The token's drawn body (its flight transform included); the scene reads its rect. */
  readonly drawn: Element;
  /** The token's own box: the spot it rests on. */
  readonly at: Element;
  readonly flying: boolean;
}
