/** A line the Title says: why a game could not be resumed (`status`), or why a replay did not open (`problem`). */
export interface TitleStatusInput {
  readonly text: string;
  readonly kind: "status" | "problem";
}
