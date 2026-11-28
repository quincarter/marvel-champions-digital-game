/** One row of the cheat sheet: a heading, a note, or a query with what it means. */
export type SearchHelpRowModel =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "query"; readonly query: string; readonly meaning: string };

/** The deck builder's search cheat sheet (issue #531): every search term, with Use and Copy on each example. */
export interface SearchHelpModel {
  readonly title: string;
  readonly backLabel: string;
  readonly useLabel: string;
  readonly copyLabel: string;
  /** What Copy says after a try: "Copied" or "Failed". */
  readonly copiedLabel: string;
  readonly failedLabel: string;
  readonly rows: readonly SearchHelpRowModel[];
  /** The row whose Copy just ran, and whether it worked: its button says so. */
  readonly copied: { readonly index: number; readonly ok: boolean } | null;
}
