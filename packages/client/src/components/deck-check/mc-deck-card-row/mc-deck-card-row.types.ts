/** One card line of the deck: its printed cost in a pip, the name, and how many copies. */
export interface DeckCardRowModel {
  /** The card's id: the row's key. */
  readonly id: string;
  readonly cost: number | null;
  /** The pip's colour (a CSS colour), the cost's own ladder. */
  readonly costColor: string;
  readonly name: string;
  readonly quantity: number;
}

export type McDeckCardRowProps = Omit<DeckCardRowModel, "id">;
