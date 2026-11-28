/** One row of a table of contents. */
export interface McTocRow {
  /** The row focus stop, and the key `mc-activate` carries ("toc:3"). */
  readonly key: string;
  /** The section title. */
  readonly title: string;
}
