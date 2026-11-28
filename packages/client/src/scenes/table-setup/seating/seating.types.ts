/** One seat of the table: the hero's name and picture, and whether it holds the first player token. */
export interface SeatCell {
  readonly index: number;
  readonly name: string;
  readonly meta: string;
  /** The compact chip's top line: "You" for seat 0, "S2" and on for the rest. */
  readonly chipLabel: string;
  readonly selected: boolean;
  /** The seated deck's hero identity card, for the seat's picture. */
  readonly identityCardId: string | undefined;
}

/** What the Seating section shows. In a room the players bring their own heroes, so only a note about the seats shows. */
export interface SeatingInput {
  readonly seats: readonly SeatCell[];
  readonly room: boolean;
}

/** What the player changed in the Seating section. */
export interface SeatingEvents {
  /** A seat holds the first player token. */
  readonly pick: (seatIndex: number) => void;
  /** Random: a roll of the seed's own first player. */
  readonly roll: () => void;
}
