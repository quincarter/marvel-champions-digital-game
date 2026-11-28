/** The Title rank card: the rank, the lifetime points and the bar to the next rank, already worded and translated. */
export interface TitleRankInput {
  /** One line (a phone strip: "RANK 1 · Sidekick") rather than a label over the rank name. */
  readonly compact: boolean;
  /** A rank-up is being announced: the card turns red and names the new rank in place of the bar. */
  readonly up: boolean;
  /** The rank ("RANK 3"), or "RANK UP"; in a compact card the whole first line. */
  readonly label: string;
  /** The rank name (a full card only). */
  readonly title: string;
  /** The lifetime points ("1,250 pts"); null while announcing a rank-up. */
  readonly points: string | null;
  /** The bar caption ("300 to Street-Level Legend"); null while announcing a rank-up. */
  readonly next: string | null;
  /** 0 to 1 toward the next rank. */
  readonly fraction: number;
  /** One sentence for assistive text. */
  readonly summary: string;
}
