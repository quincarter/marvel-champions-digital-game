/** One chip of the type filter ("All", "Ally", ...). */
export interface TypeChipModel {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
}

/** The pool's type filter: a label over wrapping chips, one of which is chosen. */
export interface TypeFiltersModel {
  readonly label: string;
  readonly chips: readonly TypeChipModel[];
}
