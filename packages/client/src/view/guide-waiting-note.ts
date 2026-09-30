/**
 * The waiting/complete compact strip's own visibility (owner phone bug report, `docs/guided-mode.md` §3.10): on a
 * tabbed form factor, `GuideController#view()`'s waiting/complete panel used to draw as the full `McGuideCallout` —
 * a large box that, between lessons, sat right over the player's own play area (its screenshot: "NEXT: THE VILLAIN
 * PHASE" covering Black Cat), and whose × ran the same "Stop the tutorial?" confirm flow an active lesson step's ×
 * does. Dismissing a note that just says "here's what's next" should never be confused with dismissing the run
 * itself, so `scenes/board/guide-mount.ts` draws that state as a small strip instead, whose × only hides *this*
 * note, locally, in the mount — nothing here ever touches `GuideController`.
 *
 * Kept as plain functions over plain data, not a class or `BoardGuideMount` method, so the "which note is this, and
 * is it still the one the player dismissed" logic is Vitest-tested without a live Phaser scene (this file's own
 * test).
 */

/** The minimal shape this module reads off `GuideControllerView` — declared locally (not imported) so this stays a
 * leaf module with nothing Phaser-shaped in its own dependency graph. */
export interface WaitingNoteView {
  readonly step: unknown;
  readonly panel: { readonly title: string } | null;
}

/**
 * A stable identity for "which waiting/complete note is this", or `null` when there's no note to show at all (a
 * scripted step is current, or the guide has nothing active). The panel's own title already changes with the
 * situation — "Next: The villain phase" vs. "Next: Threat & thwarting" vs. "Tutorial complete" — so it doubles as
 * the identity a dismissal is remembered against.
 */
export function waitingNoteKeyOf(view: WaitingNoteView): string | null {
  if (view.step || !view.panel) return null;
  return view.panel.title;
}

/**
 * Whether the strip should draw this frame, given the current note's own key and whichever key the player's ×
 * last dismissed (`null` once nothing has been dismissed, or once a *different* note has since become current —
 * `docs/guided-mode.md` §3.10 "never locked in": dismissing one note must never silently suppress a later,
 * different one, e.g. the next lesson's own wait or the tutorial-complete note).
 */
export function waitingNoteVisible(key: string | null, dismissedKey: string | null): boolean {
  return key !== null && key !== dismissedKey;
}
