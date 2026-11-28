/** One row of the picker: a heading (a pack's wave) or a choice that toggles. */
export type PoolPickRowModel =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "choice"; readonly id: string; readonly name: string; readonly selected: boolean };

/** The deck builder's pack and wave picker (issue #977): several are chosen at once; "All" clears the choice. */
export interface PoolPickModel {
  readonly title: string;
  readonly subtitle: string;
  readonly allLabel: string;
  /** Nothing is chosen: "All" is on. */
  readonly allChosen: boolean;
  readonly rows: readonly PoolPickRowModel[];
  readonly doneLabel: string;
}
