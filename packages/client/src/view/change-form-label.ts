import type { Form } from "@mc/engine";

/**
 * The action bar's changeForm button label when only one destination form is
 * legal (`scenes/board/action-bar.ts`'s own "Change form" branch covers more
 * than one). Plain TypeScript, no live Phaser scene — same trade
 * `view/chip-layout.ts` makes, for the same reason (a pure function a test
 * can check without a canvas).
 *
 * `stacked` (phone and tablet-portrait's two-row bar) gets a quarter-width
 * cell — one of four `BASICS` across the bar minus its own gutters — which
 * "Flip to alter-ego" doesn't fit even at `fitText`'s floor size (QA fix H:
 * it used to drop the verb and read bare "TO HERO" / "TO A-E", sitting right
 * under the tutorial's "TRY THIS" tag with no verb left to tell them apart).
 * "Flip A-E" / "Flip Hero" keeps "Flip" and reuses the design's existing
 * "A-E" abbreviation for alter-ego, and fits at both 390 (phone) and 768
 * (tablet portrait) width — see `change-form-label.test.ts`. The wide bar has
 * room to spell both words out.
 */
export function changeFormLabel(myForm: Form, stacked: boolean): string {
  const toAlterEgo = myForm === "hero";
  if (!stacked) return toAlterEgo ? "Flip to alter-ego" : "Flip to hero";
  return toAlterEgo ? "Flip A-E" : "Flip Hero";
}
