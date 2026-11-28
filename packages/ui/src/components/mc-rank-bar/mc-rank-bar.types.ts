/** The rank plate's words and bar, already worded and translated by the client (`view/title-rank-badge.ts`). */
export interface RankBarModel {
  /** One line (a phone's strip: "RANK 1 · Sidekick in Training") rather than a label over a title. */
  readonly compact: boolean;
  /** A rank-up is being announced: the plate turns red and names the new rank in place of the bar. */
  readonly up: boolean;
  /** The rank ("RANK 3"), or "RANK UP"; in a compact plate the whole first line. */
  readonly label: string;
  /** The rank's name (a full plate only). */
  readonly title: string;
  /** The lifetime points ("1,250 pts"), at the right of the first line; null while announcing a rank-up. */
  readonly points: string | null;
  /** The bar's caption ("300 to Street-Level Legend"); null while announcing a rank-up. */
  readonly next: string | null;
  /** 0 to 1 toward the next rank. */
  readonly fraction: number;
  /** One sentence for assistive text. */
  readonly summary?: string;
}
