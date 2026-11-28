/** One villain of the Focus view's side list. */
export interface StatsSideRowModel {
  /** The grid row it shows: the focus stop is `side:<row>`. */
  readonly row: number;
  readonly name: string;
  /** "9/63": beaten, of the columns. */
  readonly score: string;
  /** The villain whose tiles are on show. */
  readonly selected: boolean;
}

export interface McStatsSideRowProps {
  model: StatsSideRowModel | null;
}
