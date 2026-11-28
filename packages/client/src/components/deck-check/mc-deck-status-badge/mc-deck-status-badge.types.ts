/** The verdict's colour: legal is green, illegal red, the two warnings caution yellow. */
export type DeckStatusBadgeTone = "legal" | "illegal" | "unscripted" | "poolChanged";

export interface McDeckStatusBadgeProps {
  /** "N CARDS · LEGAL", already translated and in capitals. */
  text: string;
  tone: DeckStatusBadgeTone;
}
