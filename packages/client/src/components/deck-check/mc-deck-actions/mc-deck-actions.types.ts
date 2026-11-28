export interface McDeckActionsProps {
  /** "stack": one over the other (the wide panel's foot); "row": side by side (the narrow footer). */
  layout: "stack" | "row";
  editLabel: string;
  startLabel: string;
  /** Why Start game cannot be pressed (the screen was not opened from a setup flow); empty when it can. */
  startUnavailable: string;
}
