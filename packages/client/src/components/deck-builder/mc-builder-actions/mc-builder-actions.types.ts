/** A button of the deck actions: its words and, when it does nothing now, why. */
export interface ActionButtonModel {
  readonly label: string;
  /** Dimmed, with this as the reason (a tooltip); `true` has none; null: live. */
  readonly disabled: string | true | null;
  /** The button is chosen (Delete, armed: the next press deletes). */
  readonly armed?: boolean;
}

/**
 * Preconstructed, Clear and Delete, and a campaign's optional deck freeze. A campaign's deck has neither Preconstructed nor
 * Clear (both replace the whole deck and would drop the campaign's own granted lines), so those are null there.
 */
export interface BuilderActionsModel {
  readonly precon: ActionButtonModel | null;
  readonly clear: ActionButtonModel | null;
  readonly delete: ActionButtonModel | null;
  readonly freeze: ActionButtonModel | null;
}
