/** One cell of a tab rail. */
export interface McTabRailTab {
  readonly id: string;
  /** The tab label, already translated. */
  readonly label: string;
  /** Dashed and unpressable. */
  readonly disabled?: boolean;
}
