/**
 * What Enter / A presses on a screen with a primary commit button (the decision popup's Confirm, the villain phase's
 * Start / Continue). The rule (owner, 2026-10-24): with nothing focused, it presses the primary when that is enabled;
 * with a control focused, it presses that control. The A / Enter glyph on the primary shows only where that is true.
 */

/** The stop Enter presses: the focused one, else the primary while it is enabled, else nothing. */
export function activationTarget(focus: string | null, primary: string | null, primaryEnabled: boolean): string | null {
  if (focus !== null) return focus;
  return primary !== null && primaryEnabled ? primary : null;
}

/** Whether the primary may wear the A / Enter glyph: it is enabled and Enter would press it. */
export function primaryGlyphShown(focus: string | null, primary: string | null, primaryEnabled: boolean): boolean {
  return primary !== null && primaryEnabled && activationTarget(focus, primary, primaryEnabled) === primary;
}
