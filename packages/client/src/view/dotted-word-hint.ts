/**
 * The D02 "Hover/Tap any dotted word for its rule" hint (guided mode design polish, `docs/guided-mode.md` §4 G8's
 * "in flight" note): a short, quiet line telling a player their current step's body has at least one `[[term]]`
 * (`view/term-text-model.ts`'s own markup) they can hover — pointer input — or tap — touch input — to read its
 * rule. It shares the rail/callout's own `nudge` slot (`scenes/board/guide-mount.ts#withFocusHint`), so it only
 * ever shows when nothing higher-priority (the gate-escape nudge) is already using that line, and it yields to
 * nothing lower-priority (the "Press G" focus-region hint) once it's the one showing.
 */
import { parseTermText } from "./term-text-model.js";

const POINTER_HINT = "Hover any dotted word for its rule";
const TOUCH_HINT = "Tap any dotted word for its rule";

/** True when `body`'s own `[[id]]` / `[[id|label]]` markup resolves at least one glossary term. */
export function bodyHasGlossaryTerm(body: string): boolean {
  return parseTermText(body).some((run) => run.kind === "term");
}

/** `null` when `body` carries no glossary term; otherwise the pointer- or touch-worded hint line for `isTouch`. */
export function dottedWordHintFor(body: string, isTouch: boolean): string | null {
  if (!bodyHasGlossaryTerm(body)) return null;
  return isTouch ? TOUCH_HINT : POINTER_HINT;
}

/**
 * The callout's own extra guard (`ui/guide-callout.ts`): true when the hint would still "fit without crowding".
 * A step with both a secondary and a primary footer button already fills the callout's action row at the
 * 390px phone width the callout is built for — the row directly under the shared nudge slot — so the hint is
 * skipped there rather than adding a fourth competing line above two buttons.
 */
export function calloutFitsDottedWordHint(hasSecondaryButton: boolean, hasPrimaryButton: boolean): boolean {
  return !(hasSecondaryButton && hasPrimaryButton);
}
