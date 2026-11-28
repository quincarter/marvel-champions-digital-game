export interface TypeFilterChip {
  /** `all`, `ally`, `event`, ...: the stop is `filter:<id>`. */
  readonly id: string;
  /** Translated. */
  readonly label: string;
}

export interface McDeckTypeFilterProps {
  /** The small heading over the chips ("Filter"). */
  heading: string;
  chips: readonly TypeFilterChip[];
  /** The chosen chip's id. */
  selected: string;
}
