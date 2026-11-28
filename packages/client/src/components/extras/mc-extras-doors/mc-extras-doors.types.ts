export interface McExtrasDoorsProps {
  /** "Trophy Room ▸" (a phone: "Trophies ▸"). */
  trophiesLabel: string;
  /** "Credits ▸". */
  creditsLabel: string;
  /** Each door takes half the row (a phone, or a rail too narrow beside them) instead of 150px. */
  stacked: boolean;
}
