/**
 * Maps `GuideController#view`'s own `McGuidePanelContent` (the desktop/tablet-landscape rail's content, shared
 * across the run) to `McGuideCalloutContent` for the phone/tablet-portrait path (guided mode G5c part 2,
 * `docs/guided-mode.md` §4 G5c item 1): both surfaces show the exact same lesson step (or waiting/complete
 * state), so this is a field-for-field reshaping, not a second copy of any copy. Kept as a plain view model,
 * with no Phaser import, so it's Vitest-tested without a canvas — `scenes/board/guide-mount.ts`'s own header
 * explains why the rest of that module (every actual `McGuideCallout` draw) can't be.
 *
 * A few fields have no callout equivalent and are folded in rather than dropped:
 *  - `tip` has no callout box (there's no room for one at 390px) — appended to `body` as its own paragraph
 *    (`McTermText` renders a blank line between paragraphs) rather than lost, since a tip line still matters on
 *    phone (lesson 3's "Energy prints two resources...").
 *  - `contextLabel`/`lessons` (the lesson list) have no callout equivalent either and are dropped outright — the
 *    callout's own `stepLabel` ("STEP 2 OF 5") already carries the run's position, and a five-row lesson list
 *    doesn't fit a 390px anchored bubble the way it fits a fixed-height rail.
 *  - `continueHint` maps straight across (an "await" step's "do this to continue" hint), per this box's own brief
 *    — but never alongside `secondaryLabel` (Back): `McGuideCallout#update` only ever draws the continue-hint
 *    line in the *absence* of any button row (`hasButtons = secondaryLabel || primaryLabel`), so a Back button
 *    would otherwise silently swallow the very "do this" text an await step exists to show (found in browser
 *    verification, G5c part 2: the "Thwart it" step, which has both a Back and a continueHint, rendered a bare
 *    "Back" button with no instruction at all). `McGuidePanel`'s own footer doesn't share this constraint — Back
 *    and the continue-hint box sit side by side there — so this drop is specific to the callout's own layout.
 */
import type { McGuideCalloutContent } from "../ui/guide-callout.js";
import type { McGuidePanelContent } from "../ui/guide-panel.js";

/** `hasBack` is the caller's own call on whether to show Back at all (`scenes/board/guide-mount.ts` only wires it
 * when `panel.backLabel` is set) — kept as a parameter rather than inferred here so this stays a pure reshape. */
export function calloutContentOf(panel: McGuidePanelContent, hasBack: boolean): McGuideCalloutContent {
  const showBack = hasBack && !panel.continueHint;
  return {
    stepLabel: panel.stepLabel ?? null,
    title: panel.title,
    body: panel.tip ? `${panel.body}\n\n${panel.tip}` : panel.body,
    skipLabel: panel.skipLabel ?? null,
    secondaryLabel: (showBack ? panel.backLabel : null) ?? null,
    primaryLabel: panel.primaryLabel ?? null,
    continueHint: panel.continueHint ?? null,
    nudge: panel.nudge ?? null,
  };
}
