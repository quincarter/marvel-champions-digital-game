/** One aspect chip, in its printed frame colors, with the "i" segment that opens its tip. */
export interface AspectChipModel {
  readonly aspect: string;
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
  readonly selected: boolean;
  /** Why the chip does nothing now (a campaign's frozen deck), or null. */
  readonly disabled: string | null;
  /** The "i" segment's accessible name; null: the chip has no tip. */
  readonly infoLabel: string | null;
  readonly infoOpen: boolean;
}

/** The aspect picker: how many aspects the identity takes, and one chip per choosable aspect. */
export interface AspectPickerModel {
  readonly label: string;
  readonly chips: readonly AspectChipModel[];
}
