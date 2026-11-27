/** One line: a name with a count at the right; `hover` names the card it stands for (the client's hover popover reads it). */
export interface LineListEntry {
  readonly name: string;
  readonly quantity: number;
  readonly hover?: string;
}

/** A titled group of lines ("Hero · 15"). */
export interface LineListGroup {
  readonly label: string;
  readonly entries: readonly LineListEntry[];
}
